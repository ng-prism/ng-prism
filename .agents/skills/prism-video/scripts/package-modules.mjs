// Turns a lift's output into Motion store documents, one JSON file per module, for ArtifactData writes with file_path.
//   node package-modules.mjs <out-dir> <mods-dir> <css-file> [scope]
// Every <state>.html becomes modules/<state>.html, the CSS modules/<css-file> with the hooks that drive the header's
// brand light from t (CSS animations do not run in a film). A second styleguide build in the same film needs its own
// scope (e.g. `ngv`): its CSS and markup then use .ngv instead of .ngp, so the two builds' rules cannot collide.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [dir, mods, cssFile, scope] = process.argv.slice(2);
mkdirSync(mods, { recursive: true });
const rescope = (s) => (scope ? s.replace(/\.ngp-body\b/g, `.${scope}-body`).replace(/\.ngp(?![\w-])/g, `.${scope}`) : s);
const rescopeHtml = (s) => (scope ? s.replace('class="ngp"', `class="${scope}"`).replace('class="ngp-body', `class="${scope}-body`) : s);
const hooks =
    '\n.ngp .prism-header__sheen::after { animation:none !important; transform:translateX(var(--sheen, -100%)) !important; }' +
    '\n.ngp .prism-header__glow::after { animation:none !important; opacity:var(--swell-o, 0) !important; transform:scale(var(--swell-s, .9)) !important; }\n';
const out = [];
const write = (name, kind, text) => {
    const file = resolve(mods, `${name}.json`);
    writeFileSync(file, JSON.stringify({ kind, text }));
    out.push(`${name}  ${(text.length / 1024).toFixed(1)} KB`);
};
write(cssFile, 'css', rescope(readFileSync(resolve(dir, cssFile), 'utf8') + hooks));
for (const f of readdirSync(dir).filter((f) => f.endsWith('.html') && !f.endsWith('.raw.html') && !f.startsWith('verify-'))) {
    write(f, 'html', rescopeHtml(readFileSync(resolve(dir, f), 'utf8')));
}
console.log(out.join('\n'));
console.log('A module may hold 200 KiB, a film 48 modules and 2 MiB of them together.');
