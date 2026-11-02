// English subtitles from the voice lines: what the voice says, written the way it is spelled. A line's `sub` wins over
// its text (a release's "twenty-two point eight" is "22.8" on screen); the sonic logo is "ng-prism" while it whispers.
import { LOGO } from './mix.mjs';

const SPELLED = [
    [/N G prism/g, 'ng-prism'],
    [/J S Doc/g, 'JSDoc']
];

const stamp = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

export function srt(lines) {
    return lines
        .map((l, i) => {
            const end = l.id === 'logo' ? l.start + LOGO.spoken + 0.1 : l.start + l.dur;
            const text = l.sub ?? SPELLED.reduce((t, [re, to]) => t.replace(re, to), l.text);
            return `${i + 1}\n${stamp(l.start)} --> ${stamp(end)}\n${text}\n`;
        })
        .join('\n');
}
