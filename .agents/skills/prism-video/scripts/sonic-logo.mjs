// Renders ng-prism's sonic logo, ../templates/sonic-logo.flac: the ElevenLabs default voice Lily whispering
// "N G prism", close, with a 3 s hall behind it. Every film uses the committed file, so this only runs when the
// maintainer asks for a new logo.
//   node sonic-logo.mjs <out.flac> [--take ../templates/sonic-logo-take.mp3]
// --take renders an existing whisper; ../templates/sonic-logo-take.mp3 is the approved one, and rendering it gives the
// committed logo bit for bit. Without --take, ElevenLabs records a new whisper (eleven_v4, seed 7, but its seed is best
// effort: every take differs a little), saved next to <out> as <out>-take.mp3; that needs ELEVENLABS_API_KEY, like
// narrate.mjs. The hall is pink noise with an exponential decay, one seed per channel.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const take = args.includes('--take') ? args[args.indexOf('--take') + 1] : undefined;
const out = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--take');
if (!out) {
    console.error('usage: node sonic-logo.mjs <out.flac> [--take <whisper.mp3>]');
    process.exit(2);
}
if (!take && !process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY is not set: create a key at elevenlabs.io → Developers → API keys and export it in ~/.zshrc.');
    process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'sonic-logo-'));
const ffmpeg = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
const [raw, hall, room, cut] = ['raw.mp3', 'hall.wav', 'room.wav', 'cut.wav'].map((f) => join(dir, f));

if (take) copyFileSync(take, raw);
else await record();

async function record() {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pFZP5JQG7iQjIQuC4Bku?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ text: '[whispers] N G prism.', model_id: 'eleven_v4', seed: 7 })
    });
    if (!res.ok) {
        console.error(`ElevenLabs answered ${res.status}: ${await res.text()}`);
        process.exit(1);
    }
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    copyFileSync(raw, out.replace(/\.flac$/, '') + '-take.mp3');
}

const noise = (seed) => ['-f', 'lavfi', '-i', `anoisesrc=d=3:c=pink:r=44100:a=0.6:seed=${seed}`];
ffmpeg(...noise(11), ...noise(23), '-filter_complex', "[0][1]amerge=inputs=2,aeval='val(0)*exp(-2.0*t)|val(1)*exp(-2.0*t)':c=stereo,highpass=f=250,lowpass=f=7000", hall);
// The whisper stays dry in the middle; 40 ms later the hall comes in behind it at 0.55.
ffmpeg(
    '-i',
    raw,
    '-i',
    hall,
    '-filter_complex',
    '[0]highpass=f=120,acompressor=threshold=0.1:ratio=3:attack=5:release=120,apad=pad_dur=3.2,asplit=2[d][s];' +
        '[d]pan=stereo|c0=c0|c1=c0[dry];' +
        '[s]pan=stereo|c0=c0|c1=c0,adelay=40|40[sw];[sw][1]afir=dry=0:wet=10[wet];' +
        "[dry][wet]amix=inputs=2:weights='1 0.55':normalize=0,loudnorm=I=-18:TP=-2,aresample=44100[o]",
    '-map',
    '[o]',
    room
);
ffmpeg('-i', room, '-af', 'atrim=0:3.6,afade=t=out:st=3.0:d=0.6', '-ar', '44100', '-ac', '2', cut);
// Starts on the whisper, 7 dB down so that it sits level with the narrator in narrate.mjs's mix.
ffmpeg(
    '-i',
    cut,
    '-af',
    'atrim=start=0.18,asetpts=PTS-STARTPTS,volume=-7dB',
    '-ar',
    '44100',
    '-sample_fmt',
    's16',
    '-metadata',
    'title=ng-prism sonic logo · voice: elevenlabs.io',
    out
);
console.log(`${out}: the sonic logo`);
