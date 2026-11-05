import { declarationsOf, isInheritable, overlaps, prelude, propertyOf, rewriteDeclarations, valueOf } from './css-rules.js';

describe('declarationsOf', () => {
    it('splits a block at its semicolons, trimmed, without empty ones', () => {
        expect(declarationsOf('color: red; margin: 0 auto;  ')).toEqual(['color: red', 'margin: 0 auto']);
        expect(declarationsOf('')).toEqual([]);
    });

    it('keeps a semicolon inside a string, a bracket or after an escape', () => {
        expect(declarationsOf('background: url("a;b.png"); content: \';\'')).toEqual(['background: url("a;b.png")', "content: ';'"]);
        expect(declarationsOf('background: url(a;b.png); --x: { a: 1; b: 2 }; --y: [;]')).toEqual(['background: url(a;b.png)', '--x: { a: 1; b: 2 }', '--y: [;]']);
        expect(declarationsOf('content: a\\;b; color: red')).toEqual(['content: a\\;b', 'color: red']);
    });

    it('keeps a shorthand with a var() whole', () => {
        expect(declarationsOf('outline: 2px solid var(--focus, rgb(0, 0, 255));')).toEqual(['outline: 2px solid var(--focus, rgb(0, 0, 255))']);
    });
});

describe('propertyOf', () => {
    it('names the property in lower case, a custom one as written', () => {
        expect(propertyOf('COLOR: red')).toBe('color');
        expect(propertyOf('  --Brand-Bg : #fff')).toBe('--Brand-Bg');
    });
});

describe('valueOf', () => {
    it('is what the declaration sets, trimmed, without its importance', () => {
        expect(valueOf('color: red')).toBe('red');
        expect(valueOf('background:  linear-gradient(red, blue) !IMPORTANT ')).toBe('linear-gradient(red, blue)');
        expect(valueOf('background-image: url(a:b.png)')).toBe('url(a:b.png)');
        expect(valueOf('--x: {a: 1}')).toBe('{a: 1}');
    });
});

describe('rewriteDeclarations', () => {
    it('keeps what `keep` accepts', () => {
        expect(rewriteDeclarations('background: #111; color: #eee; --x: 1;', { keep: isInheritable })).toBe('color: #eee; --x: 1');
        expect(rewriteDeclarations('background: #111;', { keep: isInheritable })).toBe('');
    });

    it('makes every declaration important once', () => {
        expect(rewriteDeclarations('color: red; outline: 2px solid var(--x) !important;', { important: true })).toBe(
            'color: red !important; outline: 2px solid var(--x) !important'
        );
    });
});

describe('isInheritable', () => {
    it('lets custom and listed inherited properties through', () => {
        for (const property of [
            '--bg',
            'color',
            'color-scheme',
            'font',
            'font-size',
            'font-variation-settings',
            'line-height',
            'list-style-type',
            '-webkit-font-smoothing'
        ]) {
            expect(isInheritable(property)).toBe(true);
        }
    });

    it('stops what would paint or lay out the scope roots themselves', () => {
        for (const property of ['background', 'background-color', 'border', 'padding', 'margin', 'display', 'opacity', 'box-shadow', 'z-index']) {
            expect(isInheritable(property)).toBe(false);
        }
    });
});

describe('overlaps', () => {
    it('matches a property with itself, its shorthand and its longhands', () => {
        expect(overlaps('color', new Set(['color']))).toBe(true);
        expect(overlaps('font', new Set(['font-size']))).toBe(true);
        expect(overlaps('font-size', new Set(['font']))).toBe(true);
    });

    it('keeps custom properties apart', () => {
        expect(overlaps('--bg', new Set(['--bg-hover']))).toBe(false);
        expect(overlaps('--bg-hover', new Set(['--bg']))).toBe(false);
        expect(overlaps('caret-color', new Set(['color']))).toBe(false);
    });
});

describe('prelude', () => {
    it('is what comes before the block or the semicolon', () => {
        expect(prelude('@keyframes fade-in { from { opacity: 0 } }')).toBe('@keyframes fade-in');
        expect(prelude('@layer base, theme;')).toBe('@layer base, theme');
        expect(prelude('.a .b {color: red;}')).toBe('.a .b');
    });
});
