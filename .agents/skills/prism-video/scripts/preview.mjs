// Previews one scene here, without the Motion player: renders it at the given times and tiles the frames.
//   node preview.mjs <scene.js> <out-prefix> <t1,t2,...> [--mods <dir>] [--dur <s>] [--asset name=path ...]
// --mods: a folder of the film's modules as package-modules.mjs writes them (<name>.json); shared.js runs first when it
// is there, else templates/shared.js. symbol.png maps to docs/logo_only_big.png unless --asset says otherwise.
// Writes <out-prefix>-<t>.png per time and <out-prefix>-sheet.png (4 per row). Read the sheet, then full frames.
/* global window -- page.evaluate runs in the browser */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const [scenePath, prefix, ts] = args;
const opt = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const times = ts.split(',').map(Number);
const mods = {};
for (const dir of opt('--mods'))
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const d = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
        mods[f.slice(0, -5)] = (d.data ?? d).text;
    }
const assets = { 'symbol.png': pathToFileURL(resolve(ROOT, 'docs/logo_only_big.png')).href };
for (const a of opt('--asset')) {
    const [name, file] = a.split('=');
    assets[name] = pathToFileURL(resolve(file)).href;
}
const shared = mods['shared.js'] ?? (existsSync(resolve(HERE, '../templates/shared.js')) ? readFileSync(resolve(HERE, '../templates/shared.js'), 'utf8') : null);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto(pathToFileURL(resolve(HERE, 'harness.html')).href);
await page.waitForTimeout(800);
await page.evaluate((c) => window.boot(c), { scene: readFileSync(scenePath, 'utf8'), shared, mods, assets, dur: Number(opt('--dur')[0] ?? 10) });
const files = [];
for (const t of times) {
    await page.evaluate((t) => window.renderAt(t), t);
    await page.waitForTimeout(40);
    const f = `${prefix}-${t.toFixed(2)}.png`;
    await page.screenshot({ path: f });
    files.push(f);
}
await browser.close();
if (files.length < 2) process.exit(0);
const cols = 4;
const layout = files.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|');
const scaled = files.map((_, i) => `[${i}]scale=480:-1[s${i}]`).join(';');
execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...files.flatMap((f) => ['-i', f]),
    '-filter_complex',
    `${scaled};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`,
    `${prefix}-sheet.png`
]);
console.log('sheet', `${prefix}-sheet.png`, '(frames in order:', times.join(', ') + ')');
