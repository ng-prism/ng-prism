// The film's timing: scenes back to back, each voice line at its time inside its scene, and the music ducked under the
// voice. The ElevenLabs lines sit at about -23.5 LUFS, the music is mastered loud: the voice plays at 2.0 (+6 dB) and
// the bed stays about 12 dB under it while it speaks.
import { n2 } from './look.mjs';

// The sonic logo: whispered 0.45 s into the title; the whisper ends 1.4 s into its file, its hall later. The hall may
// run under the title's line, so only the whisper counts against the scene.
export const LOGO = { at: 0.45, spoken: 1.4 };
export const LEVELS = { intro: 0.5, bed: 0.3, under: 0.1, voice: 2.0 };
// ids the film itself uses: the sonic logo's clip, the root composition, the music clip
const RESERVED = new Set(['logo', 'main', 'music']);
const seconds = (x) => typeof x === 'number' && Number.isFinite(x);

// A typo in film.mjs must stop here: a missing number would turn into NaN, and NaN passes every comparison below.
function validate(scenes) {
    const seen = new Set();
    for (const s of scenes) {
        if (RESERVED.has(s.id)) throw new Error(`scene id '${s.id}' is taken by the film itself (${[...RESERVED].join(', ')}): rename the scene`);
        if (seen.has(s.id)) throw new Error(`scene id '${s.id}' is used twice`);
        seen.add(s.id);
        if (!seconds(s.dur) || s.dur <= 0) throw new Error(`scene '${s.id}': dur must be a number of seconds above 0`);
        if (s.vo && (!seconds(s.vo.at) || s.vo.at < 0)) throw new Error(`scene '${s.id}': vo.at must be a number of seconds from 0 on`);
    }
}

/**
 * scenes: { id, kind, dur, vo?: { at, text, seed?, sub? } }[]; voice: { <scene id>: seconds, logo: seconds }.
 * Returns { total, scenes: { id, start, dur }[], lines: { id, start, dur, text, sub? }[] } and throws when a line runs
 * past its scene or into the next line.
 */
export function layout(scenes, voice) {
    validate(scenes);
    let at = 0;
    const placed = [];
    const lines = [];
    for (const s of scenes) {
        const start = n2(at);
        placed.push({ id: s.id, start, dur: s.dur });
        if (s.kind === 'title' && !seconds(voice.logo)) throw new Error('no length for the sonic logo: run narrate.mjs');
        if (s.kind === 'title') lines.push({ id: 'logo', start: n2(start + LOGO.at), dur: voice.logo, text: 'ng-prism' });
        if (s.vo) {
            const dur = voice[s.id];
            if (!seconds(dur)) throw new Error(`no voice length for scene '${s.id}': run narrate.mjs`);
            const line = { id: s.id, start: n2(start + s.vo.at), dur, text: s.vo.text };
            if (s.vo.sub) line.sub = s.vo.sub;
            lines.push(line);
        }
        at += s.dur;
    }
    const spoken = lines.filter((l) => l.id !== 'logo');
    spoken.forEach((l, i) => {
        const next = spoken[i + 1];
        const end = l.start + l.dur;
        if (next && end > next.start + 0.005)
            throw new Error(`the line of scene '${l.id}' runs ${(end - next.start).toFixed(2)} s into the line of scene '${next.id}': shorten it or move one of them`);
        const scene = placed.find((s) => s.id === l.id);
        const over = end - (scene.start + scene.dur);
        if (over > 0.05)
            throw new Error(`the line of scene '${l.id}' runs ${over.toFixed(2)} s past the scene's end: shorten it, start it earlier or lengthen the scene`);
    });
    for (const l of lines.filter((x) => x.id === 'logo')) {
        const scene = placed.find((s) => l.start >= s.start && l.start < s.start + s.dur);
        if (l.start + LOGO.spoken > scene.start + scene.dur + 0.05) throw new Error(`the sonic logo runs past scene '${scene.id}'`);
    }
    return { total: n2(at), scenes: placed, lines };
}

/**
 * The music's volume lane, in the music clip's own time: INTRO before the first line, UNDER while the voice speaks
 * (gaps under 2 s stay down), BED between lines, INTRO again after the last. The sonic logo does not duck.
 */
export function duck(lines, musicStart, total) {
    const { intro, bed, under } = LEVELS;
    const spans = [];
    for (const { start, dur } of lines.filter((l) => l.id !== 'logo')) {
        const a = Math.max(0, start - musicStart),
            e = start + dur - musicStart;
        const prev = spans[spans.length - 1];
        if (prev && a - prev[1] < 2.0) prev[1] = e;
        else spans.push([a, e]);
    }
    const len = total - musicStart;
    const pts = [{ t: 0, v: intro }];
    spans.forEach(([a, e], i) => {
        pts.push(
            { t: n2(Math.max(0.01, a - 0.3)), v: i ? bed : intro },
            { t: n2(Math.max(0.02, a)), v: under },
            { t: n2(Math.min(len, e + 0.1)), v: under },
            { t: n2(Math.min(len, e + 0.6)), v: i === spans.length - 1 ? intro : bed }
        );
    });
    return pts;
}
