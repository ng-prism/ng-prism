import { SCOPE_OUT_SUFFIX, scopeIn, scopeOut, SIM_SCOPE, SIM_SCOPE_ATTR, unscopeOut } from './scope-selector.js';

const S = ':where([data-prism-sim], .cdk-overlay-container)';

describe('scope constants', () => {
    it('name the scope by its attribute and the overlay container', () => {
        expect(SIM_SCOPE_ATTR).toBe('data-prism-sim');
        expect(SIM_SCOPE).toBe('[data-prism-sim], .cdk-overlay-container');
        expect(SCOPE_OUT_SUFFIX).toBe(`:not(${S} *, ${S})`);
    });
});

describe('scopeIn', () => {
    it('matches inside or at a scope root, with the same specificity', () => {
        expect(scopeIn('.a .b')).toBe(`${S} .a .b, .a .b${S}`);
        expect(scopeIn('.a, .b')).toBe(`${S} .a, .a${S}, ${S} .b, .b${S}`);
        expect(scopeIn('.x:hover::before')).toBe(`${S} .x:hover::before, .x:hover${S}::before`);
    });

    it('maps the document root to the scope root', () => {
        expect(scopeIn(':root')).toBe(S);
        expect(scopeIn('html .card')).toBe(`${S} .card, .card${S}`);
        expect(scopeIn('body')).toBe(S);
    });

    it('splits the list at top-level commas only', () => {
        expect(scopeIn('.a:is(.b, .c)')).toBe(`${S} .a:is(.b, .c), .a:is(.b, .c)${S}`);
        expect(scopeIn('.a:not(.b, .c) .d')).toBe(`${S} .a:not(.b, .c) .d, .a:not(.b, .c) .d${S}`);
        expect(scopeIn('.a:where(.b, .c)')).toBe(`${S} .a:where(.b, .c), .a:where(.b, .c)${S}`);
        expect(scopeIn('.a:has(> .b, + .c)')).toBe(`${S} .a:has(> .b, + .c), .a:has(> .b, + .c)${S}`);
        expect(scopeIn('.a:is(.b:not(.c, .d), .e)')).toBe(`${S} .a:is(.b:not(.c, .d), .e), .a:is(.b:not(.c, .d), .e)${S}`);
        expect(scopeIn('[data-x="a,b"], .c')).toBe(`${S} [data-x="a,b"], [data-x="a,b"]${S}, ${S} .c, .c${S}`);
        expect(scopeIn("[data-x='a,b'] .c")).toBe(`${S} [data-x='a,b'] .c, [data-x='a,b'] .c${S}`);
    });

    it('ignores a comma that is escaped or inside a string', () => {
        expect(scopeIn('.a\\,b')).toBe(`${S} .a\\,b, .a\\,b${S}`);
        expect(scopeIn('[title="a, b"]')).toBe(`${S} [title="a, b"], [title="a, b"]${S}`);
    });

    it('keeps a trailing pseudo-element at the end', () => {
        expect(scopeIn('.a::after')).toBe(`${S} .a::after, .a${S}::after`);
        expect(scopeIn('input::placeholder')).toBe(`${S} input::placeholder, input${S}::placeholder`);
        expect(scopeIn('.a > .b::marker')).toBe(`${S} .a > .b::marker, .a > .b${S}::marker`);
        expect(scopeIn('.a::part(thumb):hover')).toBe(`${S} .a::part(thumb):hover, .a${S}::part(thumb):hover`);
        expect(scopeIn('.a:is(.b, .c)::before')).toBe(`${S} .a:is(.b, .c)::before, .a:is(.b, .c)${S}::before`);
    });

    it('keeps a legacy single-colon pseudo-element at the end', () => {
        expect(scopeIn('.a:before')).toBe(`${S} .a:before, .a${S}:before`);
        expect(scopeIn('.a:AFTER')).toBe(`${S} .a:AFTER, .a${S}:AFTER`);
        expect(scopeIn('p:first-line')).toBe(`${S} p:first-line, p${S}:first-line`);
        expect(scopeIn('p:first-letter')).toBe(`${S} p:first-letter, p${S}:first-letter`);
    });

    it('does not take a pseudo-class, an escaped colon or an attribute value for a pseudo-element', () => {
        expect(scopeIn('.a:hover')).toBe(`${S} .a:hover, .a:hover${S}`);
        expect(scopeIn('.a\\:before')).toBe(`${S} .a\\:before, .a\\:before${S}`);
        expect(scopeIn('[title="::before"]')).toBe(`${S} [title="::before"], [title="::before"]${S}`);
        expect(scopeIn('.a:not(:before)')).toBe(`${S} .a:not(:before), .a:not(:before)${S}`);
    });

    it('puts the scope in front of a pseudo-element that has no element of its own', () => {
        expect(scopeIn('::selection')).toBe(`${S} ::selection, ${S}::selection`);
        expect(scopeIn('.a ::before')).toBe(`${S} .a ::before, .a ${S}::before`);
    });

    it('lets the scope root stand in for the root, keeping what else the root compound says', () => {
        expect(scopeIn('html')).toBe(S);
        expect(scopeIn('HTML')).toBe(S);
        expect(scopeIn(':ROOT')).toBe(S);
        expect(scopeIn(':root.dark')).toBe(`${S}.dark`);
        expect(scopeIn(':root:not([data-theme="light"])')).toBe(`${S}:not([data-theme="light"])`);
        expect(scopeIn('html.dark .card')).toBe(`${S}.dark .card`);
        expect(scopeIn(':root::before')).toBe(`${S}::before`);
        expect(scopeIn('body .a .b')).toBe(`${S} .a .b, .a .b${S}`);
        expect(scopeIn(':root, .a')).toBe(`${S}, ${S} .a, .a${S}`);
    });

    it('does not mistake a longer name for the root', () => {
        expect(scopeIn('html-foo')).toBe(`${S} html-foo, html-foo${S}`);
        expect(scopeIn('.body')).toBe(`${S} .body, .body${S}`);
        expect(scopeIn('bodyx .a')).toBe(`${S} bodyx .a, bodyx .a${S}`);
    });

    it('is only inside the scope for a root that a combinator other than whitespace follows', () => {
        expect(scopeIn('html > .card')).toBe(`${S} > .card`);
        expect(scopeIn(':root + .card')).toBe(`${S} + .card`);
    });

    it('treats a root deeper in the selector like any other compound', () => {
        expect(scopeIn('.a :root')).toBe(`${S} .a :root, .a :root${S}`);
        expect(scopeIn('.a:not(:root)')).toBe(`${S} .a:not(:root), .a:not(:root)${S}`);
    });

    it('returns an empty list for an empty list', () => {
        expect(scopeIn('')).toBe('');
        expect(scopeIn('  ')).toBe('');
    });

    it('trims each selector', () => {
        expect(scopeIn('  .a  ,\n.b ')).toBe(`${S} .a, .a${S}, ${S} .b, .b${S}`);
    });
});

describe('scopeOut', () => {
    it('excludes the scope and is undone by unscopeOut', () => {
        expect(scopeOut('.a .b')).toBe(`.a .b${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut('.a::after, .b')).toBe(`.a${SCOPE_OUT_SUFFIX}::after, .b${SCOPE_OUT_SUFFIX}`);
        expect(unscopeOut(scopeOut('.a::after, .b'))).toBe('.a::after, .b');
        expect(scopeOut(':root')).toBe(':root');
    });

    it('excludes the scope from each selector of a list, not from commas inside a function', () => {
        expect(scopeOut('.a:is(.b, .c), [x="1,2"]')).toBe(`.a:is(.b, .c)${SCOPE_OUT_SUFFIX}, [x="1,2"]${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut('.a:not(.b, .c)::before')).toBe(`.a:not(.b, .c)${SCOPE_OUT_SUFFIX}::before`);
    });

    it('keeps a pseudo-element, legacy or not, behind the exclusion', () => {
        expect(scopeOut('.a:before')).toBe(`.a${SCOPE_OUT_SUFFIX}:before`);
        expect(scopeOut('p:first-letter')).toBe(`p${SCOPE_OUT_SUFFIX}:first-letter`);
        expect(scopeOut('.a::part(x):hover')).toBe(`.a${SCOPE_OUT_SUFFIX}::part(x):hover`);
        expect(scopeOut('.a ::before')).toBe(`.a ${SCOPE_OUT_SUFFIX}::before`);
        expect(scopeOut('::selection')).toBe(`${SCOPE_OUT_SUFFIX}::selection`);
    });

    it('leaves a selector that only targets the document root alone', () => {
        expect(scopeOut('html')).toBe('html');
        expect(scopeOut('HTML')).toBe('HTML');
        expect(scopeOut('body')).toBe('body');
        expect(scopeOut(':ROOT')).toBe(':ROOT');
        expect(scopeOut(':root.dark')).toBe(':root.dark');
        expect(scopeOut(':root:not([data-theme="light"])')).toBe(':root:not([data-theme="light"])');
        expect(scopeOut('html body')).toBe('html body');
        expect(scopeOut(':root::before')).toBe(':root::before');
    });

    it('scopes out the other selectors of a list that also has a root one', () => {
        expect(scopeOut(':root, .a')).toBe(`:root, .a${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut('.a, body')).toBe(`.a${SCOPE_OUT_SUFFIX}, body`);
    });

    it('scopes out a selector that merely mentions the root', () => {
        expect(scopeOut('html .card')).toBe(`html .card${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut(':root > .card')).toBe(`:root > .card${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut('.a:not(:root)')).toBe(`.a:not(:root)${SCOPE_OUT_SUFFIX}`);
        expect(scopeOut('html-foo')).toBe(`html-foo${SCOPE_OUT_SUFFIX}`);
    });
});

describe('unscopeOut', () => {
    // Every shape scopeOut treats differently: plain, list, pseudo-element, legacy
    // pseudo-element, root, functional pseudo-classes, strings, escapes, odd whitespace.
    const LISTS = [
        '.a',
        '.a .b',
        '.a, .b',
        '.a,.b',
        '  .a ,\n .b  ',
        '.a::after',
        '.a::after, .b',
        '.a:before',
        'p:first-line',
        '.a::part(x):hover',
        '.a ::before',
        '::selection',
        ':root',
        'html',
        'body',
        ':root.dark',
        ':root, .a',
        '.a, body',
        'html .card',
        '.a:is(.b, .c)::before',
        '.a:not(.b, .c) .d',
        '[data-x="a,b"], .c',
        '.a\\,b',
        '.a\\:before',
        `.a${SCOPE_OUT_SUFFIX}`
    ];

    it.each(LISTS)('gives %j back after scopeOut', (list) => {
        expect(unscopeOut(scopeOut(list))).toBe(list);
    });

    it('gives the list back when scopeOut was applied twice and undone twice', () => {
        expect(unscopeOut(unscopeOut(scopeOut(scopeOut('.a::after, .b'))))).toBe('.a::after, .b');
    });

    it('removes only the exclusion scopeOut added', () => {
        expect(unscopeOut(`.a${SCOPE_OUT_SUFFIX}${SCOPE_OUT_SUFFIX}`)).toBe(`.a${SCOPE_OUT_SUFFIX}`);
    });

    it('leaves a list alone that has no exclusion', () => {
        expect(unscopeOut('.a, .b::after')).toBe('.a, .b::after');
        expect(unscopeOut(':root')).toBe(':root');
    });
});
