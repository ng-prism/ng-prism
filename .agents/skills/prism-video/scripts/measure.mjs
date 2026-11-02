// Measures what the camera and the cursor aim at, in every lifted state a film uses.
//   node measure.mjs <film>
// Reads the marks of .videos/reference/<film>/film.mjs ({ 'build/state': { mark: selector } }), renders each state in
// the film's window (1440x900 at 240,90 on the 1920x1080 stage) with the film's fonts, and writes the marks' boxes in
// stage space to .videos/work/<film>/coords.json ({ state: { mark: { x, y, w, h } } }), plus a screenshot per state in
// measure/. HyperFrames forbids layout reads inside a timeline, so the build bakes these numbers in. A state that was
// not lifted, or a mark that matches nothing, stops the run with exit 1.
/* global document -- page.evaluate runs in the browser */
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BASE, FONTS } from './lib/look.mjs';
import { ROOT, SKILL, loadFilm, paths } from './lib/paths.mjs';
import { loadCss, loadState } from './lib/states.mjs';

export const missingMarks = (coords) =>
    Object.entries(coords).flatMap(([state, marks]) => Object.entries(marks).flatMap(([mark, box]) => (box ? [] : [`${state}.${mark}`])));

// `exists` gets 'build/state.html'; the caller resolves it against the film's lift dirs.
export const unliftedStates = (marks, exists) => Object.keys(marks).filter((ref) => !exists(`${ref}.html`));

// The page assets as file URLs: the fonts from the skill, the logo from the docs.
const local = (css) =>
    css
        .replaceAll("url('assets/fonts/", `url('${pathToFileURL(join(SKILL, 'assets/fonts')).href}/`)
        .replaceAll("url('assets/img/symbol.png')", `url('${pathToFileURL(join(ROOT, 'docs/logo_only_big.png')).href}')`);

async function main(name) {
    const film = await loadFilm(name);
    const p = paths(name);
    const marks = film.marks ?? {};
    const unlifted = unliftedStates(marks, (f) => {
        const [build, file] = f.split('/');
        return existsSync(join(film.liftDir(build), file));
    });
    if (unlifted.length) {
        for (const ref of unlifted) console.error(`no lifted state '${ref}' in ${film.liftDir(ref.split('/')[0])}`);
        process.exit(1);
    }
    const names = Object.keys(marks).map((ref) => ref.split('/')[1]);
    const twice = names.filter((s, i) => names.indexOf(s) !== i);
    if (twice.length) {
        console.error(`state names must be unique across builds (coords.json is keyed by state): ${twice.join(', ')}`);
        process.exit(1);
    }
    mkdirSync(p.measureDir, { recursive: true });
    const require = createRequire(join(ROOT, 'package.json'));
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const css = Object.fromEntries(Object.keys(film.builds).map((b) => [b, existsSync(join(film.liftDir(b), film.builds[b].css)) ? loadCss(film, b) : '']));
    const coords = {};
    for (const [ref, want] of Object.entries(marks)) {
        const [build, state] = ref.split('/');
        // a file:// page, not setContent: a page under about:blank does not load file:// fonts
        const file = join(p.measureDir, `${state}.html`);
        writeFileSync(
            file,
            `<!doctype html><html><head><meta charset="utf-8"><style>${local(FONTS + BASE)}${css[build]}
            body{margin:0;width:1920px;height:1080px;background:#080d19}</style></head>
            <body><div class="win">${loadState(film, ref, 'm')}</div></body></html>`
        );
        await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        coords[state] = await page.evaluate((want) => {
            const r = {};
            for (const [k, sel] of Object.entries(want)) {
                const el = document.querySelector('.win ' + sel);
                const b = el?.getBoundingClientRect();
                r[k] = b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null;
            }
            return r;
        }, want);
        await page.screenshot({ path: join(p.measureDir, `${state}.png`) });
    }
    await browser.close();
    const missing = missingMarks(coords);
    for (const m of missing) {
        const [state, mark] = m.split('.');
        console.error(`no mark '${mark}' in state '${state}'`);
    }
    if (missing.length) process.exit(1);
    writeFileSync(p.coords, JSON.stringify(coords, null, 1));
    console.log(`${p.coords}: ${Object.keys(coords).length} states, ${Object.values(coords).reduce((n, m) => n + Object.keys(m).length, 0)} marks`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (!process.argv[2]) {
        console.error('usage: node measure.mjs <film>');
        process.exit(2);
    }
    await main(process.argv[2]);
}
