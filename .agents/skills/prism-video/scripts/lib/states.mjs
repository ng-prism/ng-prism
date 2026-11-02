// Lifted styleguide states, made fit for a film: each build's CSS under its own scope class, no transitions or
// animations (they run on the browser's clock, not the film's), and ids unique per window.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// .ngp / .ngp-body → .<scope> / .<scope>-body, so two styleguide builds can share one page; other .ngp-* classes stay.
export const rescope = (css, scope) => (scope === 'ngp' ? css : css.replace(/\.ngp-body\b/g, `.${scope}-body`).replace(/\.ngp(?![\w-])/g, `.${scope}`));

// A lookbehind, not a group: a group would swallow the `;` the next declaration needs, and keep it.
export const still = (css) => css.replace(/(?<=^|[;{\s])(transition|animation)(-[a-z-]+)?\s*:[^;}]*;?/g, '');

// Several windows share one film: prefix every id and every reference to one.
export const prefixIds = (html, wid) =>
    html
        .replace(/ id="([^"]+)"/g, ` id="${wid}-$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${wid}-$1)`)
        .replace(/href="#([^"]+)"/g, `href="#${wid}-$1"`);

// `film` carries `builds` ({ <build>: { scope, css } }) and `liftDir(build)`; `ref` is 'build/state'.
export function loadState(film, ref, wid) {
    const [build, state] = ref.split('/');
    const { scope } = film.builds[build];
    let html = readFileSync(join(film.liftDir(build), `${state}.html`), 'utf8');
    if (scope !== 'ngp') html = html.replace('class="ngp"', `class="${scope}"`).replace('class="ngp-body', `class="${scope}-body`);
    return prefixIds(html, wid);
}

// Builds whose lifted CSS is missing: their windows would be unstyled and their marks measured wrong.
export const missingCss = (film, exists = existsSync) =>
    Object.entries(film.builds)
        .map(([b, { css }]) => [b, css, join(film.liftDir(b), css)])
        .filter(([, , path]) => !exists(path))
        .map(([b, , path]) => `build '${b}' has no lifted CSS at ${path} (the cssName of its lift config must match builds.${b}.css)`);

// A build's lifted CSS as the film uses it.
export const loadCss = (film, build) => still(rescope(readFileSync(join(film.liftDir(build), film.builds[build].css), 'utf8'), film.builds[build].scope));
