// Voices a film's lines with ElevenLabs text to speech and measures them.
//   node narrate.mjs <film> [--dry]
// Reads the `vo` of every scene in .videos/reference/<film>/film.mjs ({ at, text, seed?, sub? }), generates each line
// once (cached in .videos/narration-cache/ by voice, model, seed and text, so editing one line regenerates only that
// one), speeds it up by 1.05 (atempo keeps the pitch) and writes .videos/work/<film>/voice/<scene>.wav plus logo.wav (the
// sonic logo, ../templates/sonic-logo.flac: Lily whispering "N G prism"), and voice.json with their lengths. Then it
// checks that every line fits its scene and stops with exit 1 if one does not.
// --dry calls no API: it measures the cached lines, estimates the others from their length, prints the characters a
// real run would generate, and checks the fit.
// Needs ELEVENLABS_API_KEY for lines not in the cache. The free plan's output may only be published with
// "elevenlabs.io" in the title, which the delivery writes into every MP4. The voice is Chris (iP95p4xoKVk53GoZ742B),
// a default voice: the free plan can't use library voices. Spell what the voice reads wrongly the way it should sound:
// "N G prism", "J S Doc" (the subtitles spell them right again).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneCtx } from './lib/beats.mjs';
import { n2 } from './lib/look.mjs';
import { layout } from './lib/mix.mjs';
import { ROOT, SKILL, loadFilm, paths } from './lib/paths.mjs';

export const VOICE = 'iP95p4xoKVk53GoZ742B';
export const MODEL = 'eleven_v4';
const TEMPO = 1.05;
// Chris after the tempo change speaks about 16 characters a second; --dry uses it for lines not yet generated.
const CPS = 16;

export const cacheKey = (voice, model, seed, text) =>
    createHash('sha256')
        .update(JSON.stringify([voice, model, seed ?? 1, text]))
        .digest('hex')
        .slice(0, 16);

const CACHE = join(ROOT, '.videos/narration-cache');
const LOGO = join(SKILL, 'templates/sonic-logo.flac');
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' });
const duration = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
const toWav = (from, to, filter) => run('ffmpeg', ['-v', 'error', '-y', '-i', from, ...(filter ? ['-af', filter] : []), '-ar', '48000', '-ac', '2', to]);

async function speak(text, seed, previous, next) {
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set: create a key at elevenlabs.io → Developers → API keys and export it in ~/.zshrc.');
        process.exit(1);
    }
    // previous_text and next_text only shape the intonation, so they stay out of the cache key
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: MODEL, seed, previous_text: previous, next_text: next })
    });
    if (!res.ok) {
        console.error(`ElevenLabs answered ${res.status}: ${await res.text()}`);
        process.exit(1);
    }
    return Buffer.from(await res.arrayBuffer());
}

async function main(name, dry) {
    const film = await loadFilm(name);
    const p = paths(name);
    const coords = existsSync(p.coords) ? JSON.parse(readFileSync(p.coords, 'utf8')) : null;
    const scenes = film.scenes(sceneCtx(coords));
    const voiced = scenes.filter((s) => s.vo);
    mkdirSync(CACHE, { recursive: true });
    if (!dry) mkdirSync(p.voiceDir, { recursive: true });
    const voice = {};
    let toGenerate = 0;
    for (const [i, s] of voiced.entries()) {
        const seed = s.vo.seed ?? 1;
        const mp3 = join(CACHE, `${cacheKey(VOICE, MODEL, seed, s.vo.text)}.mp3`);
        if (!existsSync(mp3)) {
            toGenerate += s.vo.text.length;
            if (dry) {
                voice[s.id] = n2(s.vo.text.length / CPS);
                console.log(`${s.id}: not generated yet, ~${voice[s.id]} s (estimated)`);
                continue;
            }
            writeFileSync(mp3, await speak(s.vo.text, seed, voiced[i - 1]?.vo.text, voiced[i + 1]?.vo.text));
        }
        const wav = dry ? join(p.work, `.dry-${s.id}.wav`) : join(p.voiceDir, `${s.id}.wav`);
        mkdirSync(p.work, { recursive: true });
        toWav(mp3, wav, `atempo=${TEMPO}`);
        voice[s.id] = n2(duration(wav));
        if (dry) run('rm', ['-f', wav]);
        console.log(`${s.id}: ${voice[s.id]} s`);
    }
    if (scenes.some((s) => s.kind === 'title')) {
        if (!dry) toWav(LOGO, join(p.voiceDir, 'logo.wav'));
        voice.logo = n2(duration(LOGO));
    }
    console.log(`${dry ? 'would generate' : 'generated'} ${toGenerate} characters; the rest came from ${CACHE}`);
    try {
        const { total } = layout(scenes, voice);
        console.log(`every line fits; the film runs ${total} s`);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
    if (!dry) {
        writeFileSync(p.voiceJson, JSON.stringify(voice));
        console.log(`${p.voiceJson} written`);
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const name = args.find((a) => !a.startsWith('--'));
    if (!name) {
        console.error('usage: node narrate.mjs <film> [--dry]');
        process.exit(2);
    }
    await main(name, args.includes('--dry'));
}
