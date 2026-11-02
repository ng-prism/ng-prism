// Renders lifted states next to the real screenshots, so a lift is checked before it goes into a film.
//   node verify-lift.mjs <out-dir> <css-file> <state> [<state> ...] [--size 390x844]
// Writes <out-dir>/cmp-<state>.png: the real styleguide on the left, the lifted copy on the right. Read every one.
// The copy uses the film's own fonts (Inter and JetBrains Mono from ../assets/fonts, as --sans and --mono), nothing
// from the network.
/* global document -- page.evaluate runs in the browser */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const si = argv.indexOf('--size');
const [W, H] = si < 0 ? [1440, 900] : argv[si + 1].split('x').map(Number);
const [dir, cssFile, ...states] = si < 0 ? argv : argv.filter((_, i) => i !== si && i !== si + 1);
const css = readFileSync(resolve(dir, cssFile), 'utf8');
const logo = pathToFileURL(resolve(ROOT, 'docs/logo_only_big.png')).href;
const fontDir = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../assets/fonts')).href;
const fonts =
    `@font-face{font-family:'Inter Prism';font-weight:100 900;src:url('${fontDir}/inter-var.woff2') format('woff2')}` +
    `@font-face{font-family:'JBM Prism';font-weight:100 800;src:url('${fontDir}/jbmono-var.woff2') format('woff2')}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const s of states) {
    const html = readFileSync(resolve(dir, `${s}.html`), 'utf8');
    const file = resolve(dir, `verify-${s}.html`);
    writeFileSync(
        file,
        `<!doctype html><html><head><meta charset="utf-8">` +
            `<style>${fonts} html,body{margin:0;background:#333} #stage{--sans:'Inter Prism';--mono:'JBM Prism';--ngp-logo:url(${logo})}</style><style>${css}</style></head>` +
            `<body><div id="stage">${html}</div></body></html>`
    );
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(dir, `lift-${s}.png`) });
    execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-i',
        resolve(dir, `real-${s}.png`),
        '-i',
        resolve(dir, `lift-${s}.png`),
        '-filter_complex',
        '[0][1]hstack,scale=1920:-1',
        resolve(dir, `cmp-${s}.png`)
    ]);
    console.log('cmp', resolve(dir, `cmp-${s}.png`));
}
await browser.close();
