import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeVariables, encodeVariables, VARIABLES_KEY } from './variables.ts';

/**
 * What @revideo/renderer (renderer-plugin.js) does with the variables: JSON with its string escapes, inside a template
 * literal, evaluated in the page. Copied here as the behaviour the transport has to survive.
 */
function revideoEmbed(variables: Record<string, unknown>): Record<string, unknown> {
    const escapeSpecialChars = (_: string, value: unknown) =>
        typeof value === 'string'
            ? value
                  .replace(/[\\]/g, '\\\\')
                  .replace(/["]/g, '\\"')
                  .replace(/[/]/g, '\\/')
                  .replace(/[\b]/g, '\\b')
                  .replace(/[\f]/g, '\\f')
                  .replace(/[\n]/g, '\\n')
                  .replace(/[\r]/g, '\\r')
                  .replace(/[\t]/g, '\\t')
            : value;
    return new Function(`return JSON.parse(\`${JSON.stringify(variables, escapeSpecialChars)}\`);`)() as Record<string, unknown>;
}

const tricky = {
    code: '/** Shows `message` until `dismiss()`. */\nconst s = `${a}`; // "quoted" \\ it’s',
    recordings: { look: { file: 'look.mp4', clicks: [2.4, 5.4] } }
};

test('raw variables with a backtick break Revideo’s embedding', () => {
    assert.throws(() => revideoEmbed(tricky), SyntaxError);
});

test('encoded variables survive Revideo’s embedding unchanged', () => {
    const embedded = revideoEmbed(encodeVariables(tricky));
    assert.deepEqual(decodeVariables(embedded[VARIABLES_KEY] as string), tricky);
});
