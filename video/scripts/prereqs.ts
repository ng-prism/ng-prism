// Checks the tools the video pipeline needs outside npm: Node, and ffmpeg with the encoders of the masters (ProRes)
// and the deliveries (H.264).
//
//   node scripts/prereqs.ts      prints every gap and exits 1, or prints nothing and exits 0
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MIN_NODE = '22.18.0';
export const REQUIRED_ENCODERS = ['libx264', 'prores_ks'] as const;

/** Encoder names from the output of `ffmpeg -encoders`: one per line, after the six-letter capability column. */
export function parseEncoders(ffmpegEncodersOutput: string): Set<string> {
    const names = new Set<string>();
    for (const line of ffmpegEncodersOutput.split('\n')) {
        const match = /^\s*[VAS][.A-Z]{5}\s+(\S+)/.exec(line);
        if (match) names.add(match[1]);
    }
    return names;
}

function versionAtLeast(found: string, required: string): boolean {
    const a = found.split('.').map(Number);
    const b = required.split('.').map(Number);
    for (let i = 0; i < b.length; i++) {
        if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
    }
    return true;
}

export function missingPrereqs(input: { nodeVersion: string; encoders: Set<string> }): string[] {
    const missing: string[] = [];
    if (!versionAtLeast(input.nodeVersion, MIN_NODE)) missing.push(`Node >= ${MIN_NODE} (found ${input.nodeVersion})`);
    for (const encoder of REQUIRED_ENCODERS) {
        if (!input.encoders.has(encoder)) missing.push(`ffmpeg encoder ${encoder}`);
    }
    return missing;
}

function commandOutput(command: string, args: string[]): string | null {
    try {
        return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const encoders = commandOutput('ffmpeg', ['-hide_banner', '-encoders']);
    const missing = missingPrereqs({
        nodeVersion: process.versions.node,
        encoders: encoders === null ? new Set() : parseEncoders(encoders)
    });
    if (encoders === null) missing.unshift('ffmpeg (brew install ffmpeg)');
    if (missing.length > 0) {
        console.error(`Missing prerequisites for the video pipeline:\n${missing.map((item) => `  - ${item}`).join('\n')}`);
        process.exit(1);
    }
}
