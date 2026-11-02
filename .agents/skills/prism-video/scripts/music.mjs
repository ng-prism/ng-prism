// Finds and fetches CC0 music through the Openverse API (Freesound and others), no account needed.
//   node music.mjs search <words…>          lists CC0 tracks: id, title, creator, length, tags, page
//   node music.mjs get <film> <openverse id>  downloads it to .videos/reference/<film>/music/ and records it in credits.json
// Only CC0: nothing else is listed or fetched. Claude can't hear music: suggest a track, the maintainer listens to it
// and confirms track and licence before it goes into a film.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from './lib/paths.mjs';

const API = 'https://api.openverse.org/v1/audio/';

export const cc0Only = (results) => results.filter((r) => r.license === 'cc0');

export const credit = (result, file) => ({ file, title: result.title, creator: result.creator, source: result.foreign_landing_url, licence: 'CC0' });

// credits.json is a list, one entry per file; a file fetched again replaces its entry.
export function addCredit(path, entry) {
    const list = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
    writeFileSync(path, JSON.stringify([...list.filter((e) => e.file !== entry.file), entry], null, 4) + '\n');
}

// Openverse throttles anonymous clients and then answers with an HTML page: wait and try again.
async function json(url) {
    for (let i = 0; i < 5; i++) {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        const body = await res.text();
        if (res.ok && body.startsWith('{')) return JSON.parse(body);
        await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
    throw new Error(`Openverse did not answer ${url}`);
}

const slug = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

async function search(words) {
    const q = new URLSearchParams({ q: words.join(' '), license: 'cc0', page_size: '20' });
    const { results } = await json(`${API}?${q}`);
    for (const r of cc0Only(results)) {
        const len = r.duration ? `${Math.round(r.duration / 1000)} s` : '?';
        console.log(`${r.id}  ${r.title} — ${r.creator} (${len})\n    tags: ${(r.tags ?? []).map((t) => t.name).join(', ')}\n    ${r.foreign_landing_url}`);
    }
}

async function get(film, id) {
    const r = await json(`${API}${id}/`);
    if (cc0Only([r]).length === 0) throw new Error(`${r.title} is licensed ${r.license}, not CC0: the films use CC0 music only`);
    const p = paths(film);
    const dir = join(p.ref, 'music');
    mkdirSync(dir, { recursive: true });
    const file = `${slug(r.title)}${extname(new URL(r.url).pathname) || '.mp3'}`;
    const res = await fetch(r.url);
    if (!res.ok) throw new Error(`download failed: ${res.status} ${r.url}`);
    writeFileSync(join(dir, file), Buffer.from(await res.arrayBuffer()));
    addCredit(p.credits, credit(r, file));
    console.log(`${join(dir, file)}: ${r.title} by ${r.creator}, CC0, ${r.foreign_landing_url}`);
    console.log("Set it as the film's music ({ file, from, at }); after a build, `hf.mjs beats <project>` lists its beats.");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [cmd, ...rest] = process.argv.slice(2);
    if (cmd === 'search' && rest.length) await search(rest);
    else if (cmd === 'get' && rest.length === 2) await get(...rest);
    else {
        console.error('usage: node music.mjs search <words…> | node music.mjs get <film> <openverse id>');
        process.exit(2);
    }
}
