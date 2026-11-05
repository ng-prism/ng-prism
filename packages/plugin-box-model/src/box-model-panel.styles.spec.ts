import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, 'box-model-panel.component.css'), 'utf8');

/** The declarations of the first rule with this selector, as `name → value`. */
function declarations(selector: string): Map<string, string> {
    const start = CSS.indexOf(`${selector} {`);

    if (start < 0) throw new Error(`${selector} not found`);
    const body = CSS.slice(start, CSS.indexOf('}', start));

    return new Map([...body.matchAll(/(--prism-bm-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

describe('box model panel layer colours', () => {
    // Regression: `--prism-bm-margin: var(--prism-bm-margin)` is a cycle, which
    // makes the property invalid, so the dark theme's margin layer lost its tint.
    it.each([':host', ":host-context(html[data-prism-theme='light'])"])('should give every layer a literal colour in %s', (selector) => {
        const layers = declarations(selector);

        expect([...layers.keys()].sort()).toEqual(['--prism-bm-border', '--prism-bm-content', '--prism-bm-margin', '--prism-bm-padding']);
        for (const [name, value] of layers) expect([name, value]).toEqual([name, expect.stringMatching(/^#[0-9a-f]{6}$/i)]);
    });
});
