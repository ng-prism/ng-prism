// How a cut's variables reach its scenes. @revideo/renderer writes them into the page inside a JavaScript template
// literal (renderer-plugin.js) and escapes neither backticks nor `${`: a source file with a backtick in a comment
// stopped the page before its first frame, without an error on the console. So all variables travel as one
// URI-encoded JSON string, which holds none of those characters. Browser-safe.

/** The one Revideo variable that carries all of a cut's variables. */
export const VARIABLES_KEY = 'payload';

export function encodeVariables(variables: Record<string, unknown>): Record<string, string> {
    return { [VARIABLES_KEY]: encodeURIComponent(JSON.stringify(variables)) };
}

export function decodeVariables<T>(payload: string): T {
    if (!payload) throw new Error(`No ${VARIABLES_KEY} variable: render the cut with scripts/render.ts`);
    return JSON.parse(decodeURIComponent(payload)) as T;
}
