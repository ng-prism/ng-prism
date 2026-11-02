// Renders a film and delivers it: the web version, the YouTube version, its thumbnail and the English subtitles.
//   node deliver.mjs <film> [--force] [--skip-render]     renders .videos/work/<film>/master-60.mp4 (HyperFrames, 60 fps),
//                                                         then writes .videos/ng-prism-<film>.mp4, -youtube.mp4,
//                                                         -youtube-thumbnail.png and .en.srt
//   node deliver.mjs tour --docs [--force]                after the maintainer's OK: copies the tour to
//                                                         docs/assets/video/tour.mp4 and writes tour-poster.png
// Nothing that exists is overwritten without --force; the run stops first and names every such file. --skip-render
// encodes the existing master again. The master's loudness is measured (target -16 LUFS ±1, true peak ≤ -1.5 dBFS);
// if it is off, the encodes correct it with a two-pass loudnorm. A release clip's web version must stay under 10 MB
// (GitHub release asset). Writes a contact sheet of the web version to .videos/work/<film>/sheet.jpg: read it.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneCtx } from './lib/beats.mjs';
import { TITLE_LOCKUP } from './lib/light.mjs';
import { layout } from './lib/mix.mjs';
import { ROOT, SKILL, loadFilm, paths } from './lib/paths.mjs';
import { srt } from './lib/srt.mjs';

const DOCS = { video: join(ROOT, 'docs/assets/video/tour.mp4'), poster: join(ROOT, 'docs/assets/video/tour-poster.png') };
const LOUD = { I: -16, TP: -1.5, LRA: 11 };

export const titleOf = (film) => `ng-prism ${film} · voice: elevenlabs.io`;

// Everything a delivery of this film may write; the docs only for the tour.
export function targets(film, kind) {
    const p = paths(film);
    return [p.web, p.youtube, p.thumb, p.srt, ...(kind === 'tour' ? [DOCS.video, DOCS.poster] : [])];
}

export const clobbered = (files, exists = existsSync) => files.filter((f) => exists(f));

const audio = (loudnorm) => [...(loudnorm ? ['-af', loudnorm] : []), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];

// 30 fps; the first frame is the title's lockup pose, so a player without a poster shows the name, not black.
export const webArgs = ({ master, out, crf, title, loudnorm }) => [
    '-v',
    'error',
    '-y',
    '-i',
    master,
    '-filter_complex',
    `[0:v]fps=30,split[a][b];[a]trim=start=${TITLE_LOCKUP}:end=${TITLE_LOCKUP + 1 / 30},setpts=PTS-STARTPTS[p];[b]trim=start_frame=1,setpts=PTS-STARTPTS[r];[p][r]concat=n=2:v=1:a=0[v]`,
    '-map',
    '[v]',
    '-map',
    '0:a',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-tune',
    'animation',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    String(crf),
    ...audio(loudnorm),
    '-metadata',
    `title=${title}`,
    '-movflags',
    '+faststart',
    out
];

// 1440p60 from the 60 fps master: YouTube gives 1440p uploads more bitrate (the shader still renders at 1080p).
export const youtubeArgs = ({ master, out, title, loudnorm }) => [
    '-v',
    'error',
    '-y',
    '-i',
    master,
    '-vf',
    'scale=2560:1440:flags=lanczos',
    '-r',
    '60',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    ...audio(loudnorm),
    '-metadata',
    `title=${title}`,
    '-movflags',
    '+faststart',
    out
];

export const posterArgs = ({ master, out, width, height }) => [
    '-v',
    'error',
    '-y',
    '-ss',
    String(TITLE_LOCKUP),
    '-i',
    master,
    '-frames:v',
    '1',
    '-vf',
    `scale=${width}:${height}:flags=lanczos`,
    out
];

const ff = (args) => execFileSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
const mb = (f) => statSync(f).size / 1e6;

function loudness(file) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
    const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
    return { I: Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)[1]), TP: Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]) };
}

// the second pass of loudnorm, from the first pass's measurement
function loudnormFor(file) {
    const r = spawnSync(
        'ffmpeg',
        ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${LOUD.I}:TP=${LOUD.TP}:LRA=${LOUD.LRA}:print_format=json`, '-f', 'null', '-'],
        {
            encoding: 'utf8'
        }
    );
    const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
    return `loudnorm=I=${LOUD.I}:TP=${LOUD.TP}:LRA=${LOUD.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

function stopIfClobbering(files, force) {
    const hit = clobbered(files);
    if (hit.length && !force) {
        console.error('these files exist; pass --force to overwrite them:');
        for (const f of hit) console.error(`  ${f}`);
        process.exit(1);
    }
}

async function main(name, { force, skipRender, docs }) {
    const film = await loadFilm(name);
    const p = paths(name);
    if (docs) {
        if (film.kind !== 'tour') throw new Error('--docs is for the tour only');
        for (const f of [p.web, p.master]) if (!existsSync(f)) throw new Error(`${f} is missing: deliver the tour first`);
        stopIfClobbering([DOCS.video, DOCS.poster], force);
        copyFileSync(p.web, DOCS.video);
        ff(posterArgs({ master: p.master, out: DOCS.poster, width: 1920, height: 1080 }));
        console.log(`${DOCS.video} (${mb(DOCS.video).toFixed(1)} MB) and ${DOCS.poster} written`);
        return;
    }
    stopIfClobbering([p.web, p.youtube, p.thumb, p.srt], force);
    const scenes = film.scenes(sceneCtx(JSON.parse(readFileSync(p.coords, 'utf8'))));
    const { total, lines } = layout(scenes, JSON.parse(readFileSync(p.voiceJson, 'utf8')));
    if (!skipRender) {
        const r = spawnSync(process.execPath, [join(SKILL, 'scripts/hf.mjs'), 'render', '--quality', 'delivery', '--fps', '60', '-o', p.master], {
            cwd: p.project,
            stdio: 'inherit'
        });
        if (r.status !== 0) process.exit(r.status ?? 1);
    }
    const len = duration(p.master);
    if (Math.abs(len - total) > 0.05) throw new Error(`the master runs ${len.toFixed(2)} s, the film ${total} s: rebuild the project`);
    const loud = loudness(p.master);
    const off = Math.abs(loud.I - LOUD.I) > 1 || loud.TP > LOUD.TP;
    console.log(`master: ${len.toFixed(2)} s, ${loud.I} LUFS, true peak ${loud.TP} dBFS${off ? ' → corrected in the encodes' : ''}`);
    const loudnorm = off ? loudnormFor(p.master) : undefined;
    const title = titleOf(name);

    ff(webArgs({ master: p.master, out: p.web, crf: film.kind === 'tour' ? 20 : 22, title, loudnorm }));
    ff(youtubeArgs({ master: p.master, out: p.youtube, title, loudnorm }));
    ff(posterArgs({ master: p.master, out: p.thumb, width: 1280, height: 720 }));
    writeFileSync(p.srt, srt(lines));
    mkdirSync(p.work, { recursive: true });
    ff(['-v', 'error', '-y', '-i', p.web, '-vf', 'fps=1/1.5,scale=320:-1,tile=6x8', '-frames:v', '1', join(p.work, 'sheet.jpg')]);
    const web = loudness(p.web);
    console.log(`${p.web}: ${mb(p.web).toFixed(1)} MB, ${web.I} LUFS, true peak ${web.TP} dBFS`);
    console.log(`${p.youtube}: ${mb(p.youtube).toFixed(1)} MB`);
    console.log(`${p.thumb}, ${p.srt}, contact sheet ${join(p.work, 'sheet.jpg')}`);
    if (film.kind === 'release' && mb(p.web) >= 10) {
        console.error(`the web version is ${mb(p.web).toFixed(1)} MB; a release asset must stay under 10 MB: raise the CRF in webArgs for this film`);
        process.exit(1);
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const name = args.find((a) => !a.startsWith('--'));
    if (!name) {
        console.error('usage: node deliver.mjs <film> [--force] [--skip-render] | node deliver.mjs tour --docs [--force]');
        process.exit(2);
    }
    try {
        await main(name, { force: args.includes('--force'), skipRender: args.includes('--skip-render'), docs: args.includes('--docs') });
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
