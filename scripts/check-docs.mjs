#!/usr/bin/env node
/**
 * Checks the docsify site under `docs/`: links, anchors, sidebar, redirects, stubs and version history.
 *
 * The docs are moved around between pages in bulk, and nothing else notices what that breaks. A link to a page
 * or to a heading that no longer exists is a 404 or a silent jump to the top of the page in the browser.
 * Run it after every move: `node scripts/check-docs.mjs`.
 *
 *   --root <dir>       docs root, default `docs`
 *   --outline          print every H1/H2/H3 of every page as a Markdown table instead of checking
 *   --anchors <page>   print the heading ids docsify generates for one page (H1 to H6, document order)
 *
 * Checks (the category in brackets leads each error line):
 *   sidebar    every `_sidebar.md` link points to a file; every page except `README.md` and the redirect sources is
 *              linked from the sidebar exactly once
 *   links      every other link resolves to a page or file, and its `#anchor` is a heading id of that page
 *   redirects  the JSON in `<script type="application/json" id="prism-redirects">` of `index.html` maps
 *              `/<old-route>` to `/<new-route>[?id=<anchor>]`; the old route has a file, the new one has a file, an
 *              anchor and a sidebar entry. A key `/<route>?id=<old-anchor>` sends one section of a page that stays to
 *              its new place: the page exists and no longer has that anchor, else the redirect would take a live
 *              section away; the target is checked the same way and names an id, else the browser keeps the old one
 *   stubs      the source of a page redirect stays a stub: at most 10 lines, with the absolute URL of the raw `.md` of
 *              its target, because agents fetch raw Markdown and never run the redirect. An anchor redirect has none
 *   history    release history (`Up to 22.x`, `beta.n`, `now lives` ...) lives on the two upgrade pages only
 *
 * Heading ids must match what docsify 4 renders, so they are computed the way it does: marked renders the heading
 * to HTML, docsify strips its `:id=` config, then slugifies with a counter per page. `--anchors` prints those ids, so
 * that they can be compared with the heading ids in the DOM of the running site.
 *
 * Links follow docsify's default `relativePath: false`: every relative link resolves from the docs root, whatever
 * page it sits on. Links with `':ignore` and any URL scheme (`https:`, `mailto:` ...) are skipped.
 *
 * Only `node:` modules, so it runs without an install.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

const CATEGORIES = ['sidebar', 'links', 'redirects', 'stubs', 'history'];
const SIDEBAR = '_sidebar.md';
const HOME = 'README.md';
const REDIRECTS_ID = 'prism-redirects';
const STUB_MAX_LINES = 10;
const STUB_URL_BASE = 'https://ng-prism.github.io/ng-prism/';
const HISTORY = /Up to 22\.|beta\.[0-9]|before 22|now lives|has moved/;
const HISTORY_PAGES = new Set(['guide/migration-v22.md', 'guide/upgrade-notes-22.md']);

// Heading ids, the way docsify 4 computes them

// docsify's `re`. The first two ranges are U+2000-U+206F and U+2E00-U+2E7F (general and supplemental punctuation),
// written as escapes: a pasted U+2000 looks like a space and would delete every letter.
const PUNCT = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

/** docsify's `slugify`. `seen` carries the counter of one page, docsify clears it after every page. */
function slugify(html, seen) {
    const slug = html
        .trim()
        .replace(/[A-Z]+/g, (s) => s.toLowerCase())
        .replace(/<[^>]+>/g, '')
        .replace(PUNCT, '')
        .replace(/\s/g, '-')
        .replace(/-+/g, '-')
        .replace(/^(\d)/, '_$1');
    const n = seen.get(slug);
    seen.set(slug, n === undefined ? 0 : n + 1);
    return n === undefined ? slug : `${slug}-${n + 1}`;
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** marked's `escape`. Text keeps entities that are already there, code spans encode every `&`. */
function escapeHtml(text, encode = false) {
    return text.replace(encode ? /[&<>"']/g : /[<>"']|&(?!#?\w+;)/g, (ch) => ENTITIES[ch]);
}

// marked 1.x, the version docsify 4 bundles
const ATTRIBUTE = String.raw`(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>\x60]+)?)`;
const INLINE_TAG = new RegExp(
    String.raw`^(?:<!--(?!-?>)[\s\S]*?-->|</[a-zA-Z][\w:-]*\s*>|<[a-zA-Z][\w-]*${ATTRIBUTE}*?\s*/?>|<\?[\s\S]*?\?>|<![a-zA-Z]+\s[\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>)`
);
const INLINE_AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/;
const INLINE_ESCAPE = /^\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/;
const INLINE_CODE = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const INLINE_LINK = /^(!?)\[((?:\[(?:\\.|[^[\]\\])*\]|\\.|`[^`]*`|[^[\]\\`])*?)\]\(\s*(?:<[^<>]*>|(?:[^\s()]|\([^\s()]*\))*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/;
const INLINE_UNDERSCORE_EM = /^(__?)(?![\s_])([\s\S]*?[^\s_])\1(?![\p{L}\p{N}_])/u;

/**
 * The inline HTML marked renders for a heading's text. Only what changes the id is modelled: code spans (content
 * escaped), links (link text kept), images (dropped), `_emphasis_` (delimiters dropped), escapes, raw HTML tags and
 * escaped text. A literal `*` or `~` needs no handling, the slug removes both anyway.
 */
function renderInline(src) {
    let out = '';
    let text = '';
    const flush = () => {
        out += escapeHtml(text);
        text = '';
    };
    let i = 0;
    while (i < src.length) {
        const rest = src.slice(i);
        let m;
        if ((m = INLINE_ESCAPE.exec(rest))) {
            flush();
            out += escapeHtml(m[1]);
        } else if ((m = INLINE_TAG.exec(rest))) {
            flush();
            out += m[0];
        } else if ((m = INLINE_LINK.exec(rest))) {
            flush();
            out += m[1] ? '' : renderInline(m[2]);
        } else if (rest[0] === '_' && !/[\p{L}\p{N}_]/u.test(src[i - 1] ?? ' ') && (m = INLINE_UNDERSCORE_EM.exec(rest))) {
            flush();
            out += renderInline(m[2]);
        } else if ((m = INLINE_CODE.exec(rest))) {
            flush();
            let code = m[2].replace(/\n/g, ' ');
            if (/[^ ]/.test(code) && /^ /.test(code) && / $/.test(code)) code = code.slice(1, -1);
            out += `<code>${escapeHtml(code, true)}</code>`;
        } else if ((m = INLINE_AUTOLINK.exec(rest))) {
            flush();
            out += escapeHtml(m[1]);
        } else {
            text += rest[0];
            i += 1;
            continue;
        }
        i += m[0].length;
    }
    flush();
    return out;
}

/** docsify's `getAndRemoveConfig`: strips ` :id=foo`, ` :ignore` and the like from a heading, `:id` overrides the slug. */
function removeDocsifyConfig(html) {
    const config = {};
    const str = html
        .replace(/^('|")/, '')
        .replace(/('|")$/, '')
        .replace(/(?:^|\s):([\w-]+:?)=?([\w-%]+)?/g, (match, key, value) => {
            if (key.includes(':')) return match;
            config[key] = (value && value.replace(/&quot;/g, '')) || true;
            return '';
        })
        .trim();
    return { str, config };
}

/** The id docsify gives a heading whose Markdown source is `text`. */
function headingId(text, seen) {
    let { str, config } = removeDocsifyConfig(renderInline(text));
    str = str.replace('<!-- {docsify-ignore} -->', '').replace('{docsify-ignore}', '').replace('<!-- {docsify-ignore-all} -->', '').replace('{docsify-ignore-all}', '');
    return slugify(config.id || str, seen);
}

// Pages

/** Marks the lines inside fenced code blocks, fences included. A longer fence can hold a shorter one. */
function markFences(lines) {
    const inside = new Array(lines.length).fill(false);
    let open = null;
    lines.forEach((line, i) => {
        const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
        if (open) {
            inside[i] = true;
            if (fence && fence[1][0] === open.char && fence[1].length >= open.size && fence[2].trim() === '') open = null;
        } else if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
            inside[i] = true;
            open = { char: fence[1][0], size: fence[1].length };
        }
    });
    return inside;
}

/** ATX headings outside fenced code with their docsify ids, in document order. */
function parseHeadings(lines, fenced) {
    const seen = new Map();
    const headings = [];
    lines.forEach((line, i) => {
        if (fenced[i]) return;
        const match = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/.exec(line);
        if (!match) return;
        let text = match[2].trim();
        const closed = text.replace(/#+$/, '');
        if (closed === '' || /[ \t]$/.test(closed)) text = closed.trim();
        headings.push({ level: match[1].length, text, line: i + 1, id: headingId(text, seen) });
    });
    return headings;
}

/** Offsets of the line starts, to turn a position in the cleaned text back into a line number. */
function lineLookup(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    return (offset) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

/** Blanks a match but keeps its newlines, so offsets and line numbers of the rest stay put. */
const blank = (match) => match.replace(/[^\n]/g, ' ');

/** Markdown links and images outside fenced code, inline code and HTML comments: `{ line, href, title, image }`. */
function parseLinks(lines, fenced) {
    const text = lines.map((line, i) => (fenced[i] ? '' : line)).join('\n');
    // a code span never crosses a blank line, so a stray backtick cannot swallow the paragraphs after it
    const cleaned = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/(`+)([^`]|[^`](?:(?!\n[ \t]*\n)[\s\S])*?[^`])\1(?!`)/g, blank);
    const lineAt = lineLookup(cleaned);
    const links = [];
    const pattern = /(!?)\[(?:\[[^\]]*\]|[^[\]])*\]\(\s*(<[^<>]*>|(?:[^\s()]|\([^\s()]*\))*)(?:\s+("[^"]*"|'[^']*'))?\s*\)/g;
    for (const match of cleaned.matchAll(pattern)) {
        links.push({ line: lineAt(match.index), href: match[2].replace(/^<|>$/g, ''), title: match[3] ?? '', image: match[1] === '!' });
    }
    return links;
}

function parsePage(path, text) {
    const lines = text.replace(/\r$/gm, '').split('\n');
    const fenced = markFences(lines);
    return { path, lines, headings: parseHeadings(lines, fenced), links: parseLinks(lines, fenced) };
}

function collectMarkdown(root, dir = '', out = []) {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) collectMarkdown(root, rel, out);
        else if (entry.name.endsWith('.md')) out.push(rel);
    }
    return out;
}

function loadSite(root) {
    const pages = new Map();
    let sidebar = null;
    for (const path of collectMarkdown(root).sort()) {
        const page = parsePage(path, readFileSync(join(root, ...path.split('/')), 'utf-8'));
        if (path === SIDEBAR) sidebar = page;
        else pages.set(path, page);
    }
    return { root, pages, sidebar };
}

// Links

/**
 * Where a link points, the way docsify routes it: `{ skip }` for external and `:ignore` links, else
 * `{ file, anchor }`, or `{ error }` when the target cannot be inside the docs root.
 */
function resolveHref(href, title, fromFile) {
    if (/:ignore/.test(title) || /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/.test(href)) return { skip: true };
    let route = href;
    let anchor = '';
    if (route.startsWith('#/')) route = route.slice(1);
    const hash = route.indexOf('#');
    if (hash >= 0) {
        anchor = route.slice(hash + 1);
        route = route.slice(0, hash);
    }
    const query = route.indexOf('?');
    if (query >= 0) {
        const id = new URLSearchParams(route.slice(query + 1)).get('id');
        if (id && !anchor) anchor = id;
        route = route.slice(0, query);
    }
    try {
        anchor = decodeURIComponent(anchor);
    } catch {
        // keep the raw text, it will not match a heading and the error shows it
    }
    if (route === '') return { file: fromFile, anchor };
    const path = posix.normalize(route.replace(/^\/+/, '') || '.');
    if (path === '..' || path.startsWith('../')) return { error: 'leaves the docs root' };
    if (path === '.' || route.endsWith('/')) return { file: posix.join(path, HOME), anchor };
    return { file: /\.[A-Za-z0-9]+$/.test(path) ? path : `${path}.md`, anchor };
}

// Checks

function check(site) {
    const errors = [];
    let linkCount = 0;
    const fail = (category, path, line, message) => errors.push({ category, path, line, message });
    const { pages, sidebar } = site;
    const hasFile = (file) => pages.has(file) || existsSync(join(site.root, ...file.split('/')));
    const anchorsOf = (file) => new Set(pages.get(file)?.headings.map((h) => h.id));

    /** Checks one link, returns the file it points to when it is fine and internal. */
    const checkLink = (category, page, link) => {
        const target = resolveHref(link.href, link.title, page.path);
        if (target.skip) return null;
        linkCount += 1;
        if (target.error) {
            fail(category, page.path, link.line, `${link.href}: ${target.error}`);
            return null;
        }
        if (!hasFile(target.file)) {
            fail(category, page.path, link.line, link.href === target.file ? `${target.file} does not exist` : `${link.href}: ${target.file} does not exist`);
            return null;
        }
        if (target.anchor && pages.has(target.file) && !anchorsOf(target.file).has(target.anchor)) {
            fail(category, page.path, link.line, `${link.href}: ${target.file} has no heading with the id "${target.anchor}"`);
        }
        return target.file;
    };

    // links
    for (const page of pages.values()) for (const link of page.links) checkLink('links', page, link);

    // sidebar
    const inSidebar = new Map();
    if (!sidebar) {
        fail('sidebar', SIDEBAR, 1, 'there is no _sidebar.md');
    } else {
        for (const link of sidebar.links) {
            const file = checkLink('sidebar', sidebar, link);
            if (file) inSidebar.set(file, [...(inSidebar.get(file) ?? []), link.line]);
        }
    }

    // redirects and stubs
    const sources = new Map();
    const html = existsSync(join(site.root, 'index.html')) ? readFileSync(join(site.root, 'index.html'), 'utf-8') : '';
    const block = new RegExp(`<script\\b([^>]*\\bid="${REDIRECTS_ID}"[^>]*)>([\\s\\S]*?)</script>`).exec(html);
    if (block) {
        const firstLine = html.slice(0, block.index).split('\n').length;
        let map = null;
        try {
            map = JSON.parse(block[2]);
        } catch (error) {
            fail('redirects', 'index.html', firstLine, `the JSON of #${REDIRECTS_ID} does not parse: ${error.message}`);
        }
        if (map && (typeof map !== 'object' || Array.isArray(map))) {
            fail('redirects', 'index.html', firstLine, `#${REDIRECTS_ID} must be an object of "/old-route": "/new-route"`);
            map = null;
        }
        for (const [from, to] of Object.entries(map ?? {})) {
            const where = `"${from}": "${to}"`;
            const line = firstLine + block[2].slice(0, Math.max(block[2].indexOf(`"${from}"`), 0)).split('\n').length - 1;
            const key = /^\/([^?#]+?)(?:\?id=([^&#?]+))?$/.exec(from);
            if (!key || key[1].endsWith('.md')) {
                fail('redirects', 'index.html', line, `${where}: the key must be a route like /guide/x or /guide/x?id=old-anchor, without .md`);
                continue;
            }
            const sourceFile = `${key[1]}.md`;
            const oldAnchor = key[2];
            if (!pages.has(sourceFile)) {
                const missing = oldAnchor ? 'an anchor redirect needs the page' : 'the stub is missing';
                fail('redirects', 'index.html', line, `${where}: ${sourceFile} does not exist, ${missing}`);
                continue;
            }
            if (oldAnchor && anchorsOf(sourceFile).has(oldAnchor)) {
                fail('redirects', 'index.html', line, `${where}: ${sourceFile} still has a heading with the id "${oldAnchor}", the redirect would hide it`);
                continue;
            }
            const target =
                typeof to === 'string' && to.startsWith('/') && !to.includes('#')
                    ? resolveHref(to, '', sourceFile)
                    : { error: 'the value must be a route like /guide/x or /guide/x?id=anchor' };
            if (target.error) {
                fail('redirects', 'index.html', line, `${where}: ${target.error}`);
                continue;
            }
            if (oldAnchor && !target.anchor) {
                fail('redirects', 'index.html', line, `${where}: an anchor redirect needs an id in its target, else the old id is kept`);
            }
            if (!oldAnchor) sources.set(sourceFile, target.file);
            if (!pages.has(target.file)) {
                fail('redirects', 'index.html', line, `${where}: ${target.file} does not exist`);
            } else {
                if (target.anchor && !anchorsOf(target.file).has(target.anchor)) {
                    fail('redirects', 'index.html', line, `${where}: ${target.file} has no heading with the id "${target.anchor}"`);
                }
                if (!inSidebar.has(target.file)) fail('redirects', 'index.html', line, `${where}: ${target.file} is not in the sidebar`);
            }
        }
    }
    for (const [sourceFile, targetFile] of sources) {
        const lines = pages.get(sourceFile).lines;
        const count = lines.at(-1) === '' ? lines.length - 1 : lines.length;
        if (count > STUB_MAX_LINES) fail('stubs', sourceFile, 1, `a stub has at most ${STUB_MAX_LINES} lines, this one has ${count}`);
        if (!pages.get(sourceFile).lines.join('\n').includes(`${STUB_URL_BASE}${targetFile}`)) {
            fail('stubs', sourceFile, 1, `the stub does not contain ${STUB_URL_BASE}${targetFile}`);
        }
    }

    // sidebar membership, now that the redirect sources are known
    for (const path of pages.keys()) {
        if (path === HOME || sources.has(path)) continue;
        const lines = inSidebar.get(path) ?? [];
        if (lines.length === 0) fail('sidebar', path, 1, 'the page is not in the sidebar');
        else if (lines.length > 1) fail('sidebar', SIDEBAR, lines[1], `${path} is in the sidebar ${lines.length} times (lines ${lines.join(', ')})`);
    }

    // history
    for (const page of pages.values()) {
        if (HISTORY_PAGES.has(page.path)) continue;
        page.lines.forEach((line, i) => {
            const match = HISTORY.exec(line);
            if (match) fail('history', page.path, i + 1, `"${match[0]}": release history belongs in guide/migration-v22.md or guide/upgrade-notes-22.md`);
        });
    }

    errors.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.line - b.line);
    return { errors, linkCount };
}

// Output

function printOutline(site) {
    console.log('| Seite | Ebene | Überschrift | Zeile | Verbleib | Task |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const page of site.pages.values()) {
        for (const heading of page.headings) {
            if (heading.level <= 3) console.log(`| ${page.path} | H${heading.level} | ${heading.text.replaceAll('|', '/')} | ${heading.line} |  |  |`);
        }
    }
}

function parseArgs(argv) {
    const options = { root: 'docs', outline: false, anchors: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) options.root = argv[++i];
        else if (argv[i] === '--outline') options.outline = true;
        else if (argv[i] === '--anchors' && argv[i + 1]) options.anchors = argv[++i];
        else {
            console.error('usage: node scripts/check-docs.mjs [--root <dir>] [--outline] [--anchors <page>]');
            process.exit(2);
        }
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (!existsSync(options.root)) {
        console.error(`docs root not found: ${options.root}`);
        process.exit(2);
    }
    const site = loadSite(options.root);

    if (options.anchors) {
        const page = site.pages.get(options.anchors.split(sep).join('/').replace(/^\.\//, ''));
        if (!page) {
            console.error(`no such page under ${options.root}: ${options.anchors}`);
            process.exit(2);
        }
        for (const heading of page.headings) console.log(heading.id);
    } else if (options.outline) {
        printOutline(site);
    } else {
        const { errors, linkCount } = check(site);
        for (const error of errors) console.log(`${error.path}:${error.line}  [${error.category}] ${error.message}`);
        console.log(`docs: ${site.pages.size} pages, ${linkCount} links, ${errors.length} errors`);
        process.exitCode = errors.length > 0 ? 1 : 0;
    }
}

main();
