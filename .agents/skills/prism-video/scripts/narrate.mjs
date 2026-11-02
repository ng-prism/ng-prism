// Lays a spoken narration over an exported film, with ElevenLabs text to speech and ffmpeg.
//   node narrate.mjs <film.mp4> <narration.json> <out.mp4> [--title "ng-prism 22.7"] [--voice <voice id>]
//                    [--model eleven_v4] [--tempo 1.05] [--dry]
// Needs ELEVENLABS_API_KEY. A free account will do, but its output may only be published with "elevenlabs.io" in the
// title: the MP4's title becomes "<--title> · voice: elevenlabs.io" (--title defaults to the out file's name).
// narration.json is a list of lines: { "at": start in s, "until": the end of the line's scene in s, "text": "…",
// "seed": optional, change it for another take of that line }. A line { "at": …, "logo": true } places the sonic logo
// instead, ../templates/sonic-logo.flac: Lily whispering "N G prism" in a hall; the next line may start under the hall.
// The voice is Chris (iP95p4xoKVk53GoZ742B), one of ElevenLabs' default voices: the free plan can't use library voices.
// Each line is generated once and cached in .videos/narration-cache/ by its text, seed, voice and model, so --dry, the
// real run and a run after editing one line spend credits only on lines that changed. A line is sped up by --tempo
// (atempo keeps the pitch), measured against its window and the next line, then placed at its start. The film's own
// sounds (clicks, keystrokes) duck under the voice, the mix is normalised to -16 LUFS, and the picture is copied, not
// re-encoded. --dry only generates and measures. Spell what the voice reads wrongly the way it should sound: "N G prism".
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
};
const valued = ['--title', '--voice', '--model', '--tempo'];
const [film, linesFile, out] = args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]));
const voice = opt('--voice', 'iP95p4xoKVk53GoZ742B');
const model = opt('--model', 'eleven_v4');
const tempo = Number(opt('--tempo', '1.05'));
const dry = args.includes('--dry');
if (!film || !linesFile || (!out && !dry)) {
    console.error(
        'usage: node narrate.mjs <film.mp4> <narration.json> <out.mp4> [--title "ng-prism 22.7"] [--voice <voice id>] [--model eleven_v4] [--tempo 1.05] [--dry]'
    );
    process.exit(2);
}

const lines = JSON.parse(readFileSync(linesFile, 'utf8'));
// The whisper ends 1.4 s into the logo's file, its hall 2 s later.
const logo = { file: fileURLToPath(new URL('../templates/sonic-logo.flac', import.meta.url)), spoken: 1.4 };
const cache = fileURLToPath(new URL('../../../../.videos/narration-cache/', import.meta.url));
mkdirSync(cache, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'narrate-'));
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' });
const duration = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

let generated = 0;
const speak = async (l, i) => {
    const seed = l.seed ?? 1;
    const key = createHash('sha256')
        .update(JSON.stringify([voice, model, seed, l.text]))
        .digest('hex')
        .slice(0, 16);
    const mp3 = join(cache, `${key}.mp3`);
    if (existsSync(mp3)) return mp3;
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set: create a key at elevenlabs.io → Developers → API keys and export it in ~/.zshrc.');
        process.exit(1);
    }
    // previous_text and next_text only shape the intonation, so they stay out of the cache key: editing one line
    // doesn't regenerate its neighbours.
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
            text: l.text,
            model_id: model,
            seed,
            previous_text: lines[i - 1]?.text,
            next_text: lines[i + 1]?.text
        })
    });
    if (!res.ok) {
        console.error(`line ${i + 1}: ElevenLabs answered ${res.status}: ${await res.text()}`);
        process.exit(1);
    }
    writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
    generated += l.text.length;
    return mp3;
};

let problems = 0;
for (const [i, l] of lines.entries()) {
    const wav = join(dir, `l${i}.wav`);
    if (l.logo) run('ffmpeg', ['-v', 'error', '-y', '-i', logo.file, wav]);
    else run('ffmpeg', ['-v', 'error', '-y', '-i', await speak(l, i), '-af', `atempo=${tempo}`, wav]);
    l.wav = wav;
    l.dur = l.logo ? logo.spoken : duration(wav);
    const end = l.at + l.dur,
        next = lines[i + 1];
    const notes = [];
    if (next && end > next.at - 0.2) notes.push(`runs into line ${i + 2}`);
    if (l.until !== undefined && end > l.until + 0.6) notes.push(`runs ${(end - l.until).toFixed(2)} s past its scene`);
    if (notes.length) problems++;
    console.log(`line ${i + 1}: ${l.at.toFixed(2)} → ${end.toFixed(2)} s (${l.logo ? 'logo' : l.dur.toFixed(2) + ' s'})${notes.length ? '  ✖ ' + notes.join(', ') : ''}`);
}
console.log(`${generated} characters generated, the rest from ${cache}`);
if (problems) {
    console.error(`${problems} line(s) do not fit: shorten them, move their start, or raise --tempo a little.`);
    process.exit(1);
}
if (dry) process.exit(0);

const title = `${opt('--title', basename(out, '.mp4'))} · voice: elevenlabs.io`;

const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
let graph = `[0:a]${fmt}[fx];`;
lines.forEach((l, i) => {
    const ms = Math.round(l.at * 1000);
    graph += `[${i + 1}:a]${fmt},adelay=${ms}|${ms}[v${i}];`;
});
graph += `${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,asplit=2[vsc][vmix];`;
graph += '[fx][vsc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=300[duck];';
graph += '[duck][vmix]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]';
run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    film,
    ...lines.flatMap((l) => ['-i', l.wav]),
    '-filter_complex',
    graph,
    '-map',
    '0:v',
    '-c:v',
    'copy',
    '-map',
    '[out]',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-t',
    String(duration(film)),
    '-metadata',
    `title=${title}`,
    '-movflags',
    '+faststart',
    out
]);
console.log(`${out}: ${duration(out).toFixed(2)} s, picture copied, title "${title}"`);
