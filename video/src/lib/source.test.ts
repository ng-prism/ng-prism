import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { codeExcerpt, stripShowcase } from './source.ts';

// The real file the tour shows, so this test breaks when the file is no longer camera-ready.
const BUTTON = readFileSync(new URL('../../../test-workspace/projects/video-lib/src/lib/button/button.component.ts', import.meta.url), 'utf8');

test('the button without its showcase starts at @Component and mentions no showcase option', () => {
    const before = codeExcerpt(stripShowcase(BUTTON));
    assert.ok(before.startsWith('@Component({'), before.slice(0, 40));
    assert.ok(!before.includes('Showcase'));
    assert.ok(!before.includes('variants'));
});

test('the button excerpt starts at @Showcase and ends with the closing brace of the class', () => {
    const after = codeExcerpt(BUTTON);
    assert.ok(after.startsWith('@Showcase({'), after.slice(0, 40));
    assert.ok(after.endsWith('}'));
});

test('stripShowcase ignores brackets inside strings, template literals and comments', () => {
    const src = "@Showcase({ title: 'a (b)', note: `c)`, tag: \"d(\" /* ) */ })\n@Component({ selector: 'x' })\nexport class X {}\n";
    assert.equal(stripShowcase(src), "@Component({ selector: 'x' })\nexport class X {}\n");
});

test('stripShowcase drops an import that only brought Showcase', () => {
    const src =
        "import { Component } from '@angular/core';\nimport { Showcase } from '@ng-prism/core';\n\n@Showcase({ title: 'X' })\n@Component({ selector: 'x' })\nexport class X {}\n";
    assert.equal(stripShowcase(src), "import { Component } from '@angular/core';\n\n@Component({ selector: 'x' })\nexport class X {}\n");
});

test('stripShowcase keeps the other specifiers of the import', () => {
    const src = "import { Showcase, providePrism } from '@ng-prism/core';\n@Showcase({})\nclass X {}\n";
    assert.equal(stripShowcase(src), "import { providePrism } from '@ng-prism/core';\nclass X {}\n");
});

test('stripShowcase throws without a @Showcase block', () => {
    assert.throws(() => stripShowcase('@Component({})\nclass X {}\n'), { message: 'No @Showcase block found' });
});

test('codeExcerpt drops imports and JSDoc above the first decorator and the trailing newline', () => {
    assert.equal(codeExcerpt("import { A } from 'a';\n\n/** Doc. */\n@Injectable()\nexport class S {}\n"), '@Injectable()\nexport class S {}');
});
