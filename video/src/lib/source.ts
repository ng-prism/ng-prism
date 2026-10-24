// Derives the code the videos show from the real source file, so the code on screen is the code that renders.

/** Index just past the `)` that closes the bracket opened at `open`, skipping strings, template literals and comments. */
function closingParen(source: string, open: number): number {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        const char = source[i];
        if (char === '/' && source[i + 1] === '/') {
            i = source.indexOf('\n', i);
            if (i === -1) break;
        } else if (char === '/' && source[i + 1] === '*') {
            i = source.indexOf('*/', i + 2) + 1;
            if (i === 0) break;
        } else if (char === "'" || char === '"' || char === '`') {
            for (i++; i < source.length && source[i] !== char; i++) {
                if (source[i] === '\\') i++;
            }
        } else if (char === '(') {
            depth++;
        } else if (char === ')' && --depth === 0) {
            return i + 1;
        }
    }
    throw new Error('Unbalanced @Showcase block');
}

function dropShowcaseImport(source: string): string {
    return source.replace(/^import \{([^}]*)\} from '@ng-prism\/core';\n/m, (line, specifiers: string) => {
        const names = specifiers
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);
        if (!names.includes('Showcase')) return line;
        const rest = names.filter((name) => name !== 'Showcase');
        return rest.length === 0 ? '' : `import { ${rest.join(', ')} } from '@ng-prism/core';\n`;
    });
}

/** The source without its `@Showcase(...)` decorator and without `Showcase` in the `@ng-prism/core` import. */
export function stripShowcase(source: string): string {
    const start = source.search(/^@Showcase\(/m);
    if (start === -1) throw new Error('No @Showcase block found');
    let end = closingParen(source, start + '@Showcase'.length);
    if (source[end] === '\n') end++;
    return dropShowcaseImport(source.slice(0, start) + source.slice(end));
}

/** From the first line that starts with a decorator to the end, without the trailing newline. */
export function codeExcerpt(source: string): string {
    const start = source.search(/^@/m);
    return (start === -1 ? source : source.slice(start)).replace(/\n+$/, '');
}
