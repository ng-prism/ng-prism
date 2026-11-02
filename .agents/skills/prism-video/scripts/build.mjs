// Generates a film's HyperFrames project from its description, the measured marks and the voice.
//   node build.mjs <film>
// Reads .videos/reference/<film>/film.mjs, .videos/work/<film>/coords.json (measure.mjs) and voice.json (narrate.mjs),
// measures the name's letters for the title and the end card, and writes .videos/work/<film>/project/: index.html (the
// scenes back to back, voice, sound effects, music ducked under the voice), compositions/<scene>.html, and assets/ (GSAP,
// fonts, logo, the lifted CSS, voice, music, sound effects). Everything the render needs is local; a lift that would
// load something from the network stops the build.
/* global document -- page.evaluate runs in the browser */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, code, sceneCtx, tourCode } from './lib/beats.mjs';
import { kinetic, slash, split } from './lib/interstitials.mjs';
import { end, title } from './lib/light.mjs';
import { FONTS, n2 } from './lib/look.mjs';
import { LEVELS, duck, layout } from './lib/mix.mjs';
import { ROOT, SKILL, loadFilm, paths } from './lib/paths.mjs';
import { loadCss, loadState } from './lib/states.mjs';

const SFX = join(ROOT, 'node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx');
// The music comes in on a beat at the title's impact (0.6 s): `from` is that beat's time in the track.
const MUSIC_AT = 0.58;

const KINDS = {
    title: (s, c) => title({ id: s.id, dur: s.dur, line: c.film.line, word: c.words.title }),
    end: (s, c) => end({ id: s.id, dur: s.dur, command: c.film.command, word: c.words.end }),
    app: (s, c) => app(s, c.ctx),
    code: (s, c) => code(s, c.ctx),
    tourCode: (s) => tourCode(s),
    slash: (s) => slash(s),
    split: (s) => split(s),
    kinetic: (s) => kinetic(s)
};

// Where a page would load something from the network: src/srcset/poster, url(), @import, and href on elements that
// load (link, use, image, script). A link a viewer would click (<a href>) or an XML namespace loads nothing.
const REMOTE = [
    /\b(?:src|srcset|poster)\s*=\s*["']?\s*https?:\/\/[^"'\s>]*/gi,
    /url\(\s*["']?\s*https?:\/\/[^)]*\)/gi,
    /@import\s+["']https?:\/\/[^"']*["']/gi,
    /<(?:link|use|image|script|img|source|iframe)\b[^>]*\s(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi
];
export const remoteRefs = (text) => REMOTE.flatMap((re) => text.match(re) ?? []);

const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));

/**
 * film: the description (with `scenes(ctx)`, `builds`, `music`, `line`, `command`); coords: coords.json; voice:
 * voice.json; words: { title, end } boxes of the name at 196 and 136 px; out: the project dir; liftDir(build),
 * voiceDir, musicDir: where the inputs are. Writes only under `out` and returns { files }.
 */
export function build({ film, coords, voice, words, out, liftDir, voiceDir, musicDir }) {
    const scenes = film.scenes(sceneCtx(coords));
    const { total, scenes: placed, lines } = layout(scenes, voice);
    const lifted = { builds: film.builds, liftDir };
    const c = { film, words, ctx: { state: (ref, wid) => loadState(lifted, ref, wid) } };
    for (const d of ['compositions', 'assets']) rmSync(join(out, d), { recursive: true, force: true });
    for (const d of ['compositions', 'assets/fonts', 'assets/img', 'assets/voice', 'assets/sfx', 'assets/music']) mkdirSync(join(out, d), { recursive: true });
    const files = [];
    const write = (rel, text) => {
        const f = join(out, rel);
        writeFileSync(f, text);
        files.push(f);
    };
    const copy = (from, rel) => {
        const f = join(out, rel);
        copyFileSync(from, f);
        files.push(f);
    };

    // scenes; their sounds move to film time
    const sfx = [];
    scenes.forEach((s, i) => {
        const make = KINDS[s.kind];
        if (!make) throw new Error(`scene '${s.id}': unknown kind '${s.kind}' (${Object.keys(KINDS).join(', ')})`);
        const { html, sfx: own } = make(s, c);
        write(`compositions/${s.id}.html`, html);
        for (const [file, at, vol, dur] of own) sfx.push([file, n2(placed[i].start + at), vol, dur]);
    });

    // assets
    copy(join(ROOT, 'node_modules/gsap/dist/gsap.min.js'), 'assets/gsap.min.js');
    for (const f of ['inter-var.woff2', 'jbmono-var.woff2']) copy(join(SKILL, 'assets/fonts', f), `assets/fonts/${f}`);
    copy(join(ROOT, 'docs/logo_only_big.png'), 'assets/img/symbol.png');
    const sheets = Object.keys(film.builds).filter((b) => existsSync(join(liftDir(b), film.builds[b].css)));
    for (const b of sheets) write(`assets/ui-${b}.css`, loadCss(lifted, b));
    for (const l of lines) copy(join(voiceDir, `${l.id}.wav`), `assets/voice/${l.id}.wav`);
    const used = [...new Set(sfx.map((s) => s[0]))];
    const sfxLen = Object.fromEntries(used.map((f) => [f, probe(join(SFX, `${f}.mp3`))]));
    for (const f of used) copy(join(SFX, `${f}.mp3`), `assets/sfx/${f}.mp3`);
    const music = film.music ? { ...film.music, at: film.music.at ?? MUSIC_AT } : null;
    if (music) copy(join(musicDir, music.file), `assets/music/${basename(music.file)}`);

    // index: scenes back to back, then the audio
    const hosts = placed.map(
        (s, i) =>
            `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${n2(s.dur)}" data-track-index="${i + 1}" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:${i + 1}"></div>`
    );
    const audio = [];
    if (music) {
        const auto = JSON.stringify({ version: 1, lanes: [{ target: 'volume', points: duck(lines, music.at, total) }] }).replace(/"/g, '&quot;');
        audio.push(
            `      <audio id="music" class="clip" src="assets/music/${basename(music.file)}" data-start="${music.at}" data-duration="${n2(total - music.at)}" data-media-start="${music.from}" data-volume="1" data-fade-out="2.2" data-track-index="20" data-timeline-role="music" data-automation="${auto}"></audio>`
        );
    }
    for (const l of lines)
        audio.push(
            `      <audio id="vo-${l.id}" class="clip" src="assets/voice/${l.id}.wav" data-start="${l.start}" data-duration="${n2(l.dur)}" data-volume="${LEVELS.voice}" data-track-index="${l.id === 'logo' ? 22 : 21}"></audio>`
        );
    sfx.forEach(([f, t, v, d], i) =>
        audio.push(
            `      <audio id="sfx${i}" class="clip" src="assets/sfx/${f}.mp3" data-start="${t}" data-duration="${n2(Math.min(d ?? sfxLen[f], sfxLen[f], total - t))}" data-volume="${v}" data-track-index="${30 + i}"></audio>`
        )
    );
    write(
        'index.html',
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>ng-prism ${film.id ?? ''}</title>
    <script src="assets/gsap.min.js"></script>
${sheets.map((b) => `    <link rel="stylesheet" href="assets/ui-${b}.css" />`).join('\n')}
    <style>
${FONTS}
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #080d19; }
      #root { position: relative; width: 1920px; height: 1080px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080" data-fps="30">
${hosts.join('\n')}
${audio.join('\n')}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`
    );

    // nothing may load from the network while the film renders
    const remote = files.filter((f) => /\.(html|css)$/.test(f)).flatMap((f) => remoteRefs(readFileSync(f, 'utf8')).map((r) => `${basename(f)}: ${r}`));
    if (remote.length) throw new Error(`the project would load from the network; fix the lift or the film:\n${remote.join('\n')}`);
    return { files, total, scenes: placed, lines, sfx: sfx.length };
}

// The name's box and the left edge of each letter, at the title's and the end card's size, in the film's font.
async function measureWords(work) {
    const require = createRequire(join(ROOT, 'package.json'));
    const { chromium } = require('playwright');
    mkdirSync(work, { recursive: true });
    const file = join(work, 'words.html');
    const fonts = FONTS.replaceAll("url('assets/fonts/", `url('${pathToFileURL(join(SKILL, 'assets/fonts')).href}/`);
    writeFileSync(file, `<!doctype html><style>${fonts} span{position:absolute;white-space:pre}</style><body></body>`);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href);
    const words = await page.evaluate(async () => {
        await document.fonts.load("700 100px 'Inter Prism'");
        const box = (text, fs) => {
            const s = document.createElement('span');
            s.style.cssText = `font-family:'Inter Prism';font-size:${fs}px;font-weight:700;letter-spacing:-0.04em;line-height:1.2`;
            s.textContent = text;
            document.body.append(s);
            const r = s.getBoundingClientRect();
            s.remove();
            return { w: r.width, h: r.height };
        };
        const word = 'ng-prism';
        const at = (fs) => ({ ...box(word, fs), xs: [...word].map((_, i) => (i ? box(word.slice(0, i), fs).w : 0)) });
        return { title: at(196), end: at(136) };
    });
    await browser.close();
    return words;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const name = process.argv[2];
    if (!name) {
        console.error('usage: node build.mjs <film>');
        process.exit(2);
    }
    const p = paths(name);
    const film = await loadFilm(name);
    for (const [f, by] of [
        [p.coords, 'measure.mjs'],
        [p.voiceJson, 'narrate.mjs']
    ])
        if (!existsSync(f)) {
            console.error(`${f} is missing: run ${by} ${name} first`);
            process.exit(1);
        }
    try {
        const r = build({
            film,
            coords: JSON.parse(readFileSync(p.coords, 'utf8')),
            voice: JSON.parse(readFileSync(p.voiceJson, 'utf8')),
            words: await measureWords(p.work),
            out: p.project,
            liftDir: film.liftDir,
            voiceDir: p.voiceDir,
            musicDir: join(p.ref, 'music')
        });
        console.log(`${p.project}: ${r.scenes.length} scenes, ${r.total} s, ${r.lines.length} voice clips, ${r.sfx} sound effects`);
        console.log(`scene starts: ${r.scenes.map((s) => `${s.id}@${s.start}`).join(' ')}`);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
