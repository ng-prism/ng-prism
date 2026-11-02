// Where a film's files live. Sources that rebuild it: .videos/reference/<film>/; everything that can be thrown away:
// .videos/work/<film>/; the finished film and its YouTube version, thumbnail and subtitles: .videos/ng-prism-<film>*.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ROOT = resolve(SKILL, '../../..');
const VIDEOS = join(ROOT, '.videos');

export function paths(film) {
    const ref = join(VIDEOS, 'reference', film);
    const work = join(VIDEOS, 'work', film);
    const out = join(VIDEOS, `ng-prism-${film}`);
    return {
        ref,
        work,
        lift: (build) => join(work, 'lift', build),
        coords: join(work, 'coords.json'),
        measureDir: join(work, 'measure'),
        voiceDir: join(work, 'voice'),
        voiceJson: join(work, 'voice.json'),
        project: join(work, 'project'),
        master: join(work, 'master-60.mp4'),
        web: `${out}.mp4`,
        youtube: `${out}-youtube.mp4`,
        thumb: `${out}-youtube-thumbnail.png`,
        srt: `${out}.en.srt`,
        credits: join(ref, 'credits.json')
    };
}

// The film description, .videos/reference/<film>/film.mjs, with the lift dirs of this film attached.
export async function loadFilm(film) {
    const p = paths(film);
    const { default: f } = await import(pathToFileURL(join(p.ref, 'film.mjs')).href);
    return { ...f, liftDir: p.lift };
}
