// The only way the film skill runs HyperFrames: telemetry, update checks and auto installs off, and only the commands
// that work on local files. Commands that upload a project, sign in, or read credentials (`usage` reads Claude Code's)
// are refused, and so are options that send frames to an outside service (`snapshot --describe` asks Gemini).
//   node hf.mjs <command> [...args]      e.g. node hf.mjs lint, node hf.mjs render --quality delivery --fps 60 -o out.mp4
// Runs in the current directory with inherited stdio and exits with HyperFrames' code; a refused command exits 2.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ALLOWED = new Set([
    'check',
    'lint',
    'validate',
    'inspect',
    'snapshot',
    'render',
    'preview',
    'beats',
    'audio',
    'browser',
    'doctor',
    'timeline',
    'info',
    'compositions',
    'keyframes'
]);
const OFF_MACHINE = ['--describe'];
const PRIVATE = { HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_NO_AUTO_INSTALL: '1' };

export function plan(argv, env = process.env) {
    const [cmd] = argv;
    if (!ALLOWED.has(cmd)) return { refused: `hf.mjs: '${cmd ?? ''}' is not run through the film skill (allowed: ${[...ALLOWED].join(', ')})` };
    const away = argv.find((a) => OFF_MACHINE.includes(a.split('=')[0]));
    if (away) return { refused: `hf.mjs: ${away.split('=')[0]} sends frames to an outside service; the film skill keeps them on this machine` };
    return { bin: resolve(ROOT, 'node_modules/.bin/hyperframes'), args: argv, env: { ...env, ...PRIVATE } };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const p = plan(process.argv.slice(2));
    if (p.refused) {
        console.error(p.refused);
        process.exit(2);
    }
    // the binary starts with #!/usr/bin/env node: run it with this node, so it works without node on the PATH
    const r = spawnSync(process.execPath, [p.bin, ...p.args], { stdio: 'inherit', env: p.env });
    process.exit(r.status ?? 1);
}
