import {
    SCOPE_IN_SUFFIX,
    SCOPE_OUT_SUFFIX,
    scopeIn,
    scopeOut,
    SIM_SCOPE,
    SIM_SCOPE_ATTR,
    splitList,
    splitPseudoElement,
    targetsRoot,
    unscopeOut
} from './scope-selector.js';

const S = ':where([data-prism-sim], .cdk-overlay-container)';
const IN = SCOPE_IN_SUFFIX;

describe('scope constants', () => {
    it('name the scope by its attribute and the overlay container', () => {
        expect(SIM_SCOPE_ATTR).toBe('data-prism-sim');
        expect(SIM_SCOPE).toBe('[data-prism-sim], .cdk-overlay-container');
        expect(SCOPE_OUT_SUFFIX).toBe(`:not(${S} *, ${S})`);
        expect(SCOPE_IN_SUFFIX).toBe(':where([data-prism-sim] *, .cdk-overlay-container *, [data-prism-sim], .cdk-overlay-container)');
    });
});

describe('scopeIn', () => {
    it('matches inside or at a scope root, with the same specificity', () => {
        expect(scopeIn('.a .b')).toBe(`.a .b${IN}`);
        expect(scopeIn('.a, .b')).toBe(`.a${IN}, .b${IN}`);
        expect(scopeIn('.x:hover::before')).toBe(`.x:hover${IN}::before`);
        expect(scopeIn('html .card')).toBe(`html .card${IN}`);
    });

    it('keeps a chain whole that crosses the scope boundary', () => {
        expect(scopeIn('.theme .b')).toBe(`.theme .b${IN}`);
        expect(scopeIn('.wrap .b')).toBe(`.wrap .b${IN}`);
        expect(scopeIn('.cdk-overlay-container .item')).toBe(`.cdk-overlay-container .item${IN}`);
        expect(scopeIn('html body .b')).toBe(`html body .b${IN}`);
        expect(scopeIn('.dark [_nghost-x]')).toBe(`.dark [_nghost-x]${IN}`);
    });

    it('sends a rule on the document root to the scope roots, keeping specificity and qualifiers', () => {
        expect(scopeIn(':root')).toBe(`:root ${S}`);
        expect(scopeIn(':root.dark')).toBe(`:root.dark ${S}`);
        expect(scopeIn('body')).toBe(`body ${S}`);
        expect(scopeIn('html')).toBe(`html ${S}`);
        expect(scopeIn('HTML')).toBe(`HTML ${S}`);
        expect(scopeIn(':ROOT')).toBe(`:ROOT ${S}`);
        expect(scopeIn(':root:not([data-theme="light"])')).toBe(`:root:not([data-theme="light"]) ${S}`);
        expect(scopeIn('html body')).toBe(`html body ${S}`);
        expect(scopeIn(':root, .a')).toBe(`:root ${S}, .a${IN}`);
    });

    it('puts an extra condition right behind the scope suffix, in front of a pseudo-element', () => {
        expect(scopeIn('.a::before', false, ':not(.x)')).toBe(`.a${IN}:not(.x)::before`);
        expect(scopeIn('.a .b:hover', false, ':not(.x)')).toBe(`.a .b:hover${IN}:not(.x)`);
        expect(scopeIn('.a, .b::after', false, ':not(.x)')).toBe(`.a${IN}:not(.x), .b${IN}:not(.x)::after`);
        expect(scopeIn('.a', false, '')).toBe(scopeIn('.a'));
    });

    it('puts the extra condition on the scope root that a rule on the document root is sent to', () => {
        expect(scopeIn(':root', false, ':not(.x)')).toBe(`:root ${S}:not(.x)`);
        expect(scopeIn(':root::before', false, ':not(.x)')).toBe(`:root ${S}:not(.x)::before`);
        expect(scopeIn('&.dark', true, ':not(.x)')).toBe(`&.dark ${S}:not(.x)`);
    });

    it('puts the scope in front of the pseudo-element of a rule on the root', () => {
        expect(scopeIn(':root::before')).toBe(`:root ${S}::before`);
        expect(scopeIn('html::selection')).toBe(`html ${S}::selection`);
    });

    it('does not take a selector for the root that merely mentions it or starts like it', () => {
        expect(scopeIn('html .card')).toBe(`html .card${IN}`);
        expect(scopeIn(':root > .card')).toBe(`:root > .card${IN}`);
        expect(scopeIn('.a:not(:root)')).toBe(`.a:not(:root)${IN}`);
        expect(scopeIn('html-foo')).toBe(`html-foo${IN}`);
        expect(scopeIn('.body')).toBe(`.body${IN}`);
        expect(scopeIn('bodyx .a')).toBe(`bodyx .a${IN}`);
    });

    it('splits the list at top-level commas only', () => {
        expect(scopeIn('.a:is(.b, .c)')).toBe(`.a:is(.b, .c)${IN}`);
        expect(scopeIn('.a:not(.b, .c) .d')).toBe(`.a:not(.b, .c) .d${IN}`);
        expect(scopeIn('.a:where(.b, .c)')).toBe(`.a:where(.b, .c)${IN}`);
        expect(scopeIn('.a:has(> .b, + .c)')).toBe(`.a:has(> .b, + .c)${IN}`);
        expect(scopeIn('.a:is(.b:not(.c, .d), .e)')).toBe(`.a:is(.b:not(.c, .d), .e)${IN}`);
        expect(scopeIn('[data-x="a,b"], .c')).toBe(`[data-x="a,b"]${IN}, .c${IN}`);
        expect(scopeIn("[data-x='a,b'] .c")).toBe(`[data-x='a,b'] .c${IN}`);
    });

    it('ignores a comma that is escaped or inside a string', () => {
        expect(scopeIn('.a\\,b')).toBe(`.a\\,b${IN}`);
        expect(scopeIn('[title="a, b"]')).toBe(`[title="a, b"]${IN}`);
    });

    it('keeps a trailing pseudo-element at the end', () => {
        expect(scopeIn('.a::after')).toBe(`.a${IN}::after`);
        expect(scopeIn('input::placeholder')).toBe(`input${IN}::placeholder`);
        expect(scopeIn('.a > .b::marker')).toBe(`.a > .b${IN}::marker`);
        expect(scopeIn('.a::part(thumb):hover')).toBe(`.a${IN}::part(thumb):hover`);
        expect(scopeIn('.a:is(.b, .c)::before')).toBe(`.a:is(.b, .c)${IN}::before`);
    });

    it('keeps a legacy single-colon pseudo-element at the end', () => {
        expect(scopeIn('.a:before')).toBe(`.a${IN}:before`);
        expect(scopeIn('.a:AFTER')).toBe(`.a${IN}:AFTER`);
        expect(scopeIn('p:first-line')).toBe(`p${IN}:first-line`);
        expect(scopeIn('p:first-letter')).toBe(`p${IN}:first-letter`);
    });

    it('does not take a pseudo-class, an escaped colon or an attribute value for a pseudo-element', () => {
        expect(scopeIn('.a:hover')).toBe(`.a:hover${IN}`);
        expect(scopeIn('.a\\:before')).toBe(`.a\\:before${IN}`);
        expect(scopeIn('[title="::before"]')).toBe(`[title="::before"]${IN}`);
        expect(scopeIn('.a:not(:before)')).toBe(`.a:not(:before)${IN}`);
    });

    it('puts the scope in front of a pseudo-element that has no element of its own', () => {
        expect(scopeIn('::selection')).toBe(`${IN}::selection`);
        expect(scopeIn('.a ::before')).toBe(`.a ${IN}::before`);
    });

    it('leaves a list that has nothing to scope as it is', () => {
        expect(scopeIn('')).toBe('');
        expect(scopeIn('  ')).toBe('  ');
    });

    it('keeps the whitespace of the list', () => {
        expect(scopeIn('  .a  ,\n.b ')).toBe(`  .a${IN}  ,\n.b${IN} `);
    });
});

describe('splitList', () => {
    it('cuts at top-level commas only and keeps the whitespace, so that the parts make the list again', () => {
        expect(splitList('.a, .b:is(.c, .d) ,[x="a,b"]')).toEqual(['.a', ' .b:is(.c, .d) ', '[x="a,b"]']);
        expect(splitList('.a, .b').join(',')).toBe('.a, .b');
        expect(splitList('.a')).toEqual(['.a']);
    });
});

describe('splitPseudoElement', () => {
    it('cuts a selector in front of its trailing pseudo-element', () => {
        expect(splitPseudoElement('.btn:hover::before')).toEqual({ element: '.btn:hover', pseudoElement: '::before' });
        expect(splitPseudoElement('.a .b:after')).toEqual({ element: '.a .b', pseudoElement: ':after' });
        expect(splitPseudoElement(' ::part(x):hover ')).toEqual({ element: '', pseudoElement: '::part(x):hover' });
    });

    it('leaves a selector without one whole, and what only looks like one inside a group or an attribute', () => {
        expect(splitPseudoElement(' .a > .b ')).toEqual({ element: '.a > .b', pseudoElement: '' });
        expect(splitPseudoElement('.a:not(.b::before)')).toEqual({ element: '.a:not(.b::before)', pseudoElement: '' });
        expect(splitPseudoElement('[x="::before"]')).toEqual({ element: '[x="::before"]', pseudoElement: '' });
    });
});

describe('targetsRoot', () => {
    it('is true when the subject of a selector is the document root', () => {
        expect(targetsRoot(':root')).toBe(true);
        expect(targetsRoot('html')).toBe(true);
        expect(targetsRoot('BODY')).toBe(true);
        expect(targetsRoot(':root.dark')).toBe(true);
        expect(targetsRoot('html:not(.light)')).toBe(true);
        expect(targetsRoot('html body')).toBe(true);
        expect(targetsRoot(':root::before')).toBe(true);
    });

    it('is true when any selector of the list targets the root', () => {
        expect(targetsRoot(':root, .x')).toBe(true);
        expect(targetsRoot('.x, body')).toBe(true);
        expect(targetsRoot('.x:is(.a, .b), html')).toBe(true);
    });

    it('is false when the root is only an ancestor or a name that starts like it', () => {
        expect(targetsRoot('html .card')).toBe(false);
        expect(targetsRoot(':root > .card')).toBe(false);
        expect(targetsRoot('.a:not(:root)')).toBe(false);
        expect(targetsRoot('.a:is(:root, body)')).toBe(false);
        expect(targetsRoot('html-foo')).toBe(false);
        expect(targetsRoot('.body')).toBe(false);
        expect(targetsRoot('.a, .b')).toBe(false);
        expect(targetsRoot('')).toBe(false);
    });

    it('takes `&` for the root in a rule nested in one', () => {
        expect(targetsRoot('&.dark', true)).toBe(true);
        expect(targetsRoot('&:hover', true)).toBe(true);
        expect(targetsRoot('.x, &', true)).toBe(true);
        expect(targetsRoot('& .x', true)).toBe(false);
        expect(targetsRoot('&.dark')).toBe(false);
    });
});

describe('a list nested in a rule on the document root', () => {
    it('goes to the scope roots where `&` is the subject', () => {
        expect(scopeIn('&.dark', true)).toBe(`&.dark ${S}`);
        expect(scopeIn('&::before', true)).toBe(`& ${S}::before`);
        expect(scopeIn('&.dark, & .x', true)).toBe(`&.dark ${S}, & .x${IN}`);
        expect(scopeIn('body', true)).toBe(`body ${S}`);
    });

    it('is left alone outside the scope where `&` is the subject', () => {
        expect(scopeOut('&.dark', true)).toBe('&.dark');
        expect(scopeOut('&.dark, & .x', true)).toBe(`&.dark, & .x${SCOPE_OUT_SUFFIX}`);
        expect(unscopeOut(scopeOut('&.dark, & .x', true))).toBe('&.dark, & .x');
    });

    it('treats `&` as any other subject in a rule nested elsewhere', () => {
        expect(scopeIn('&.dark')).toBe(`&.dark${IN}`);
        expect(scopeOut('&.dark')).toBe(`&.dark${SCOPE_OUT_SUFFIX}`);
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

    it('takes out the suffix it is given, for a browser that wrote it differently', () => {
        const written = ':not(:where([data-prism-sim],.cdk-overlay-container) *,:where([data-prism-sim],.cdk-overlay-container))';

        expect(unscopeOut(`.a${written}::after, .b${written}, :root`, written)).toBe('.a::after, .b, :root');
        expect(unscopeOut(`.a${written}`)).toBe(`.a${written}`);
    });
});

describe('scopeIn and scopeOut', () => {
    const SCOPED = ['.a', '.a .b', '.a, .b', '.a::after, .b', '.a:before', '.a ::before', '::selection', '  .a ,\n .b  ', 'html .card', '.a:is(.b, .c)::before'];

    it.each(SCOPED)('insert at the same point in %j', (list) => {
        expect(scopeIn(list).split(SCOPE_IN_SUFFIX).join('')).toBe(list);
        expect(scopeOut(list).split(SCOPE_OUT_SUFFIX).join('')).toBe(list);
    });
});
