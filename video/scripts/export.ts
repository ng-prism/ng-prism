// Turns a master into what gets published.
//
//   node scripts/export.ts tour                out/deliver/tour.mp4, and for the docs start page
//                                              docs/assets/video/tour.mp4 with tour-poster.png (the end card)
//   node scripts/export.ts release-<version>   out/deliver/release-<version>.mp4
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../src/lib/recordings.ts';
import { mp4Args, posterArgs } from './export-plan.ts';
import { MASTERS_DIR } from './render.ts';

const DELIVER_DIR = join(REPO_ROOT, 'video/out/deliver');
const DOCS_VIDEO_DIR = join(REPO_ROOT, 'docs/assets/video');

function ffmpeg(args: string[]): void {
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
}

function master(cut: string): string {
    const file = join(MASTERS_DIR, `${cut}.mov`);
    if (!existsSync(file)) throw new Error(`No master ${file}: render the cut first (npm run render -- ${cut.replace(/^release-/, 'release --version ')})`);
    return file;
}

/** The master as an MP4 for social posts and release notes. */
function deliver(cut: string): string {
    mkdirSync(DELIVER_DIR, { recursive: true });
    const output = join(DELIVER_DIR, `${cut}.mp4`);
    ffmpeg(mp4Args(master(cut), output));
    console.log(output);
    return output;
}

/** The tour also plays on the docs start page; its poster is the last frame, the end card with the logo. */
function exportTour(): void {
    const mp4 = deliver('tour');
    mkdirSync(DOCS_VIDEO_DIR, { recursive: true });
    copyFileSync(mp4, join(DOCS_VIDEO_DIR, 'tour.mp4'));
    ffmpeg(posterArgs(master('tour'), join(DOCS_VIDEO_DIR, 'tour-poster.png')));
    console.log('docs/assets/video/tour.mp4, tour-poster.png');
}

const cut = process.argv[2];
if (cut === 'tour') exportTour();
else if (cut?.startsWith('release-')) deliver(cut);
else throw new Error(`Usage: node scripts/export.ts <tour|release-<version>>, not "${cut}"`);
