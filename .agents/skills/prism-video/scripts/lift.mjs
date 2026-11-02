// Lifts the DOM and the used CSS of styleguide states into Motion film modules.
//   node lift.mjs <config.json> <out-dir>
// The config names the served styleguide (`base`), the CSS file to write (`cssName`) and the steps: `goto` a query,
// `click` a selector, `clickText` a button's name, `fill` a selector with `text`, `press` a key, `hover` a selector,
// `waitFor` a selector, `eval` code, `capture` a state (with `marks`, which put data-v hooks on elements for the camera
// and the cursor; a mark with `text` needs the element's whole text to match). Writes <state>.html, real-<state>.png and <cssName> into <out-dir>.
// One out dir per styleguide build: the _ngcontent ids differ between builds.
/* global document, getComputedStyle, innerWidth, innerHeight, location, matchMedia, CSS, CSSStyleRule, CSSMediaRule, CSSSupportsRule, CSSLayerBlockRule, CSSKeyframesRule, CSSFontFaceRule, CSSImportRule, FileReader, NodeFilter -- page.evaluate runs in the browser */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { chromium } = require('playwright');

const [configPath, outDir] = process.argv.slice(2);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
// `viewport` lifts at another size (a phone: { width: 390, height: 844 }); `touch` emulates a touch screen, so
// (pointer: coarse) and the touch-sized controls apply.
const VW = config.viewport?.width ?? 1440,
    VH = config.viewport?.height ?? 900;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, ...(config.touch ? { hasTouch: true, isMobile: true } : {}) });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => {
    if (m.text().startsWith('repaired')) console.log(m.text());
});

const cssOrder = [];
const cssSeen = new Set();
const report = [];

async function capture(name, marks) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/real-${name}.png` });
    const res = await page.evaluate(async (marks) => {
        const W = innerWidth,
            H = innerHeight;
        // ---------- CSS ----------
        const splitSel = (s) => {
            const out = [];
            let depth = 0,
                cur = '';
            for (const ch of s) {
                if (ch === '(' || ch === '[') depth++;
                if (ch === ')' || ch === ']') depth--;
                if (ch === ',' && depth === 0) {
                    out.push(cur);
                    cur = '';
                } else cur += ch;
            }
            out.push(cur);
            return out.map((x) => x.trim()).filter(Boolean);
        };
        const PSEUDO =
            /::?(?:hover|focus-visible|focus-within|focus|active|visited|before|after|placeholder-shown|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|popover-open|-webkit-[\w-]+|-moz-[\w-]+|-ms-[\w-]+)(?![\w-])/g;
        const used = (selText) =>
            splitSel(selText).some((sel) => {
                const s = sel.replace(PSEUDO, '').trim();
                if (!s || /^[>+~]/.test(s)) return true;
                try {
                    return !!document.querySelector(s.replace(/[>+~]\s*$/, ''));
                } catch {
                    return true;
                }
            });
        const out = [];
        const norm = (x) =>
            x
                .replace(/\s+/g, ' ')
                .replace(/\s*([>+~,])\s*/g, '$1')
                .replace(/["']/g, '')
                .trim();
        const parseRaw = (t) => {
            t = t.replace(/\/\*[\s\S]*?\*\//g, '');
            const map = new Map();
            const rec = (src) => {
                let i = 0;
                while (i < src.length) {
                    const open = src.indexOf('{', i);
                    if (open < 0) break;
                    const prelude = src.slice(i, open).trim();
                    let depth = 1,
                        j = open + 1;
                    while (j < src.length && depth) {
                        if (src[j] === '{') depth++;
                        else if (src[j] === '}') depth--;
                        j++;
                    }
                    const body = src.slice(open + 1, j - 1);
                    if (prelude.startsWith('@')) rec(body);
                    else map.set(norm(prelude), body);
                    i = j;
                }
            };
            rec(t);
            return map;
        };
        const rawCache = new Map();
        const rawOf = async (sheet) => {
            if (!rawCache.has(sheet)) {
                const t = sheet.ownerNode?.tagName === 'STYLE' ? sheet.ownerNode.textContent : await (await fetch(sheet.href)).text();
                rawCache.set(sheet, parseRaw(t));
            }
            return rawCache.get(sheet);
        };
        let repaired = 0,
            unrepaired = [];
        const walk = async (rules, sink, sheet) => {
            for (const r of rules) {
                if (r instanceof CSSStyleRule) {
                    if (!used(r.selectorText)) continue;
                    let text = r.cssText;
                    if (/:\s*;/.test(text)) {
                        const body = (await rawOf(sheet)).get(norm(r.selectorText));
                        if (body) {
                            text = r.selectorText + ' {' + body + '}';
                            repaired++;
                        } else unrepaired.push(r.selectorText);
                    }
                    sink.push(text);
                } else if (r instanceof CSSMediaRule) {
                    if (matchMedia(r.conditionText).matches) await walk(r.cssRules, sink, sheet);
                } else if (r instanceof CSSSupportsRule) {
                    if (CSS.supports(r.conditionText)) await walk(r.cssRules, sink, sheet);
                } else if (typeof CSSLayerBlockRule !== 'undefined' && r instanceof CSSLayerBlockRule) {
                    const inner = [];
                    await walk(r.cssRules, inner, sheet);
                    if (inner.length) sink.push(`@layer ${r.name} {\n${inner.join('\n')}\n}`);
                } else if (r instanceof CSSKeyframesRule || r instanceof CSSFontFaceRule || r instanceof CSSImportRule) {
                    /* drop */
                } else sink.push(r.cssText);
            }
        };
        for (const sheet of document.styleSheets) {
            let rules;
            try {
                rules = sheet.cssRules;
            } catch {
                continue;
            }
            await walk(rules, out, sheet);
        }
        console.log('repaired', repaired, 'unrepaired', unrepaired.join(' | '));

        // ---------- HTML ----------
        const all = [document.body, ...document.body.querySelectorAll('*')];
        all.forEach((el, i) => el.setAttribute('data-lift-id', String(i)));
        const info = new Map();
        for (const el of all) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            info.set(el.getAttribute('data-lift-id'), {
                r,
                display: cs.display,
                popover: el.matches?.(':popover-open') ?? false,
                st: el.scrollTop,
                sl: el.scrollLeft,
                tag: el.tagName
            });
        }
        // values of form controls
        for (const el of document.body.querySelectorAll('input, textarea')) {
            if (el.type === 'checkbox' || el.type === 'radio') {
                el.toggleAttribute('data-lift-checked', el.checked);
            } else el.setAttribute('data-lift-value', el.value);
        }
        const canvases = new Map();
        for (const c of document.body.querySelectorAll('canvas')) {
            try {
                canvases.set(c.getAttribute('data-lift-id'), c.toDataURL());
            } catch {
                // a canvas that cannot be read (tainted) stays as it is
            }
        }
        const markIds = {};
        for (const m of marks || []) {
            let el = null;
            if (m.text) el = [...document.querySelectorAll(m.selector || '*')].find((e) => e.textContent.trim() === m.text);
            else el = document.querySelector(m.selector);
            if (el) markIds[el.getAttribute('data-lift-id')] = m.as;
            else markIds['missing:' + m.as] = m.as;
        }
        const clone = document.body.cloneNode(true);
        all.forEach((el) => el.removeAttribute('data-lift-id'));
        for (const el of document.body.querySelectorAll('[data-lift-value],[data-lift-checked]')) {
            el.removeAttribute('data-lift-value');
            el.removeAttribute('data-lift-checked');
        }

        clone.querySelectorAll('script, style, link, noscript, template, iframe').forEach((n) => n.remove());
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach((c) => c.remove());

        let removed = 0;
        for (const el of [...clone.querySelectorAll('[data-lift-id]')]) {
            if (!clone.contains(el)) continue;
            const id = el.getAttribute('data-lift-id');
            const i = info.get(id);
            if (!i) continue;
            if (markIds[id]) el.setAttribute('data-v', markIds[id]);
            if (i.display === 'none' && !i.popover) {
                el.remove();
                removed++;
                continue;
            }
            const { r } = i;
            if ((r.width > 0 || r.height > 0) && (r.top >= H + 40 || r.left >= W + 40)) {
                el.remove();
                removed++;
                continue;
            }
            if (i.popover) {
                el.removeAttribute('popover');
                el.setAttribute('data-popover-open', '');
                el.setAttribute(
                    'style',
                    (el.getAttribute('style') || '') +
                        `;position:fixed;z-index:2147483000;position-area:none;position-anchor:auto;position-try-fallbacks:none;inset:auto;margin:0;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`
                );
            }
            if (i.st > 0 || i.sl > 0) {
                el.setAttribute('data-lift-scroll', '');
                el.setAttribute('style', (el.getAttribute('style') || '') + `;--sx:${i.sl}px;--sy:${i.st}px;`);
            }
            if (canvases.has(id)) {
                const img = document.createElement('img');
                img.src = canvases.get(id);
                img.className = el.className;
                img.style.cssText = `width:${r.width}px;height:${r.height}px;display:block`;
                el.replaceWith(img);
                continue;
            }
            if (el.hasAttribute('data-lift-value')) {
                el.setAttribute('value', el.getAttribute('data-lift-value'));
                if (el.tagName === 'TEXTAREA') el.textContent = el.getAttribute('data-lift-value');
                el.removeAttribute('data-lift-value');
            }
            if (el.hasAttribute('data-lift-checked')) {
                el.setAttribute('checked', '');
                el.removeAttribute('data-lift-checked');
            }
        }
        for (const el of [clone, ...clone.querySelectorAll('*')]) {
            for (const a of [...el.attributes]) {
                if (
                    a.name === 'data-lift-id' ||
                    a.name.startsWith('ng-reflect') ||
                    a.name === 'ng-version' ||
                    a.name === 'ngh' ||
                    a.name.startsWith('on') ||
                    a.name === 'popovertarget' ||
                    a.name === 'aria-describedby' ||
                    a.name === 'tabindex'
                )
                    el.removeAttribute(a.name);
            }
        }
        // inline non-data images
        const toData = async (url) => {
            const b = await (await fetch(url)).blob();
            return await new Promise((res) => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result);
                fr.readAsDataURL(b);
            });
        };
        for (const img of clone.querySelectorAll('img')) {
            const s = img.getAttribute('src');
            if (s && !s.startsWith('data:')) img.setAttribute('src', await toData(new URL(s, location.href).href));
        }
        let css = out;
        const urls = new Set();
        for (const t of css) for (const m of t.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!m[1].startsWith('data:') && !m[1].startsWith('#')) urls.add(m[1]);
        const urlMap = {};
        for (const u of urls) {
            try {
                urlMap[u] = await toData(new URL(u, location.href).href);
            } catch {
                urlMap[u] = null;
            }
        }

        const de = document.documentElement;
        const wrap = `<div class="ngp" data-theme="${de.dataset.theme || ''}" style="${(de.getAttribute('style') || '').replace(/"/g, "'")}"><div class="ngp-body ${document.body.className}">${clone.innerHTML}</div></div>`;
        return { css, html: wrap, removed, urlMap, missing: Object.keys(markIds).filter((k) => k.startsWith('missing:')) };
    }, marks);
    for (let t of res.css) {
        for (const [u, d] of Object.entries(res.urlMap)) if (d) t = t.split(u).join(d);
        if (!cssSeen.has(t)) {
            cssSeen.add(t);
            cssOrder.push(t);
        }
    }
    writeFileSync(`${outDir}/${name}.raw.html`, res.html);
    report.push(`${name}: html ${(res.html.length / 1024).toFixed(0)} KB, pruned ${res.removed}, missing marks ${res.missing.join(',') || '-'}`);
}

async function step(s) {
    if (s.goto !== undefined) {
        await page.goto(config.base + s.goto, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
    }
    if (s.click) {
        await page.locator(s.click).first().click();
        await page.waitForTimeout(s.wait ?? 900);
    }
    if (s.clickText) {
        await page
            .getByRole(s.role || 'button', { name: s.clickText, exact: true })
            .first()
            .click();
        await page.waitForTimeout(s.wait ?? 900);
    }
    if (s.fill) {
        await page
            .locator(s.fill)
            .first()
            .fill(s.text ?? '');
        await page.waitForTimeout(s.wait ?? 700);
    }
    if (s.press) {
        await page.keyboard.press(s.press);
        await page.waitForTimeout(s.wait ?? 500);
    }
    if (s.hover) {
        await page.locator(s.hover).first().hover();
        await page.waitForTimeout(s.wait ?? 700);
    }
    if (s.waitFor) await page.locator(s.waitFor).first().waitFor();
    if (s.eval) {
        await page.evaluate(s.eval);
        await page.waitForTimeout(s.wait ?? 500);
    }
    if (s.capture) await capture(s.capture, s.marks);
}
for (const s of config.steps) await step(s);
await browser.close();

// ---------- post-process CSS ----------
const rewriteSel = (sel) =>
    sel
        .replace(/:root(?![\w-])/g, '.ngp')
        .replace(/(^|[\s,>+~(])html(?=[\s.#[:,>+~)]|$)/g, '$1.ngp')
        .replace(/(^|[\s,>+~(])body(?=[\s.#[:,>+~)]|$)/g, '$1.ngp-body')
        .replace(/:popover-open/g, '[data-popover-open]');
const scopeSel = (selText) => {
    const parts = [];
    let depth = 0,
        cur = '';
    for (const ch of selText) {
        if ('(['.includes(ch)) depth++;
        if (')]'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) {
            parts.push(cur);
            cur = '';
        } else cur += ch;
    }
    parts.push(cur);
    return parts
        .map((p) => {
            p = rewriteSel(p.trim());
            return p.startsWith('.ngp') ? p : `:where(.ngp) ${p}`;
        })
        .join(', ');
};
const px = (n, base) => `${+((parseFloat(n) * base) / 100).toFixed(3)}px`;
const fixValues = (body) =>
    body
        .replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g, (_, n) => px(n, VH))
        .replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g, (_, n) => px(n, VW))
        .replace(/(font-family|--[\w-]*font[\w-]*)\s*:\s*([^;}]*)/g, (m, prop, val) => {
            if (/JetBrains/i.test(val)) return `${prop}: var(--mono, "JetBrains Mono", ui-monospace, monospace)`;
            if (/\bInter\b/.test(val)) return `${prop}: var(--sans, Inter, system-ui, sans-serif)`;
            return m;
        });
const processRule = (text) => {
    if (text.startsWith('@layer') && text.includes('{')) {
        const head = text.slice(0, text.indexOf('{') + 1);
        const inner = text.slice(text.indexOf('{') + 1, text.lastIndexOf('}'));
        return head + '\n' + inner.split('\n').filter(Boolean).map(processRule).join('\n') + '\n}';
    }
    if (text.startsWith('@')) return fixValues(text);
    const i = text.indexOf('{');
    return scopeSel(text.slice(0, i)) + ' ' + fixValues(text.slice(i));
};
let css = cssOrder.map(processRule).join('\n');
css += `\n.ngp { position:relative; width:${VW}px; height:${VH}px; overflow:hidden; contain:layout paint; text-align:left; }\n.ngp-body { margin:0; width:100%; height:100%; }\n[data-lift-scroll] { overflow:hidden !important; }\n[data-lift-scroll] > * { translate: calc(-1 * var(--sx, 0px)) calc(-1 * var(--sy, 0px)); }\n`;
writeFileSync(`${outDir}/${config.cssName}`, css);

// html: also rewrite fonts inside the root style
for (const s of config.steps.filter((x) => x.capture)) {
    const p = `${outDir}/${s.capture}.raw.html`;
    let h = readFileSync(p, 'utf8');
    h = h.replace(/(--[\w-]*font[\w-]*)\s*:\s*([^;"]*)/g, (m, prop, val) =>
        /JetBrains/i.test(val)
            ? `${prop}: var(--mono, 'JetBrains Mono', ui-monospace, monospace)`
            : /\bInter\b/.test(val)
              ? `${prop}: var(--sans, Inter, system-ui, sans-serif)`
              : m
    );
    h = h.replace(/url\(&quot;data:image\/svg\+xml,[^&]+&quot;\)/g, 'var(--ngp-logo)');
    h = h.replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g, (_, n) => px(n, VH)).replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g, (_, n) => px(n, VW));
    writeFileSync(`${outDir}/${s.capture}.html`, h);
}
console.log(report.join('\n'));
console.log(`css ${(css.length / 1024).toFixed(0)} KB, ${cssOrder.length} rules`);
