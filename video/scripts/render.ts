// Renders one cut to a ProRes master in out/masters/.
//
//   node scripts/render.ts <sandbox|tour|release> [--version 22.7]
import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { assertFresh, hashSources, REPO_ROOT, SOURCE_PATHS, type RecordingInfo, type RecordingsManifest } from '../src/lib/recordings.ts';
import { SHOTS } from '../record/shots/index.ts';
import { parseRelease } from '../src/lib/release.ts';
import { codeExcerpt, stripShowcase } from '../src/lib/source.ts';
import { encodeVariables } from '../src/lib/variables.ts';

export type Cut = 'sandbox' | 'tour' | 'release';
export interface CutOptions {
    version?: string;
}

const VIDEO_ROOT = join(REPO_ROOT, 'video');
export const MASTERS_DIR = join(VIDEO_ROOT, 'out/masters');
const MANIFEST = join(VIDEO_ROOT, 'out/recordings/manifest.json');

/**
 * Revideo looks up media for its ffmpeg side at `<outDir>/../public/<src>`, so with outDir out/masters the public
 * directory is out/public; it is Vite's publicDir too. Scenes refer to `/recordings/<file>` and `/sfx/<file>`.
 */
const PUBLIC_DIR = join(VIDEO_ROOT, 'out/public');
const PUBLIC_LINKS: Record<string, string> = { recordings: '../recordings', sfx: '../../assets/sfx' };

function preparePublicDir(): void {
    mkdirSync(PUBLIC_DIR, { recursive: true });
    for (const [name, target] of Object.entries(PUBLIC_LINKS)) {
        const link = join(PUBLIC_DIR, name);
        if (!existsSync(link)) symlinkSync(target, link);
    }
}

function readManifest(): RecordingsManifest {
    if (!existsSync(MANIFEST)) throw new Error('No recordings yet: run `npm run record` first');
    return JSON.parse(readFileSync(MANIFEST, 'utf8')) as RecordingsManifest;
}

function byId(manifest: RecordingsManifest): Record<string, RecordingInfo> {
    return Object.fromEntries(manifest.shots.map((shot) => [shot.id, shot]));
}

const BUTTON_SOURCE = join(REPO_ROOT, 'test-workspace/projects/video-lib/src/lib/button/button.component.ts');
const TOUR_SHOTS = ['reveal', 'controls', 'quality', 'states'] as const;

/** The recordings, refused when they were made from other sources than the ones on disk now (No-Go 1). */
async function freshRecordings(requiredIds: readonly string[]): Promise<Record<string, RecordingInfo>> {
    const manifest = readManifest();
    assertFresh(manifest, await hashSources(SOURCE_PATHS), requiredIds);
    return byId(manifest);
}

/** The button before and after its @Showcase, as the code card shows it, and how many lines the decorator has. */
function buttonCode(): { codeBefore: string; codeAfter: string; showcaseLines: number } {
    const source = readFileSync(BUTTON_SOURCE, 'utf8');
    const codeAfter = codeExcerpt(source);
    return { codeBefore: codeExcerpt(stripShowcase(source)), codeAfter, showcaseLines: codeAfter.split('\n').findIndex((line) => line.startsWith('@Component')) };
}

const RELEASES_DIR = join(VIDEO_ROOT, 'releases');
const VIDEO_LIB_SRC = join(REPO_ROOT, 'test-workspace/projects/video-lib/src');

/** A release clip's description (releases/<version>.json), the code of its API beats before and after, its recordings. */
async function releaseVariables(version: string | undefined): Promise<Record<string, unknown>> {
    if (!version) throw new Error('A release clip needs --version, e.g. --version 22.7');
    const file = join(RELEASES_DIR, `${version}.json`);
    if (!existsSync(file)) throw new Error(`No release description ${file}`);
    const clip = parseRelease(JSON.parse(readFileSync(file, 'utf8')), new Set(SHOTS.map((shot) => shot.id)));
    const code = Object.fromEntries(
        clip.beats.flatMap((beat) => {
            if (beat.kind !== 'api') return [];
            const source = readFileSync(join(VIDEO_LIB_SRC, beat.source), 'utf8');
            return [[beat.source, { before: codeExcerpt(stripShowcase(source)), after: codeExcerpt(source) }]];
        })
    );
    return { clip, code, recordings: await freshRecordings(clip.beats.map((beat) => beat.shot)) };
}

/** Everything a cut's scenes read through `cutVariables()`; render() hands it over encoded (see lib/variables.ts). */
export async function variablesFor(cut: Cut, options: CutOptions = {}): Promise<Record<string, unknown>> {
    switch (cut) {
        case 'sandbox':
            return { recordings: byId(readManifest()) };
        case 'tour':
            return { ...buttonCode(), recordings: await freshRecordings(TOUR_SHOTS) };
        case 'release':
            return releaseVariables(options.version);
        default:
            throw new Error(`No variables for the cut "${cut}" yet`);
    }
}

/** Renders `src/projects/<cut>.ts` to `out/masters/<outFile>` (a .mov ProRes master) and returns its path. */
export async function render(cut: Cut, variables: Record<string, unknown>, outFile: string): Promise<string> {
    // Before the renderer is loaded: Revideo reads it when it starts (exactly the string 'true').
    process.env.DISABLE_TELEMETRY = 'true';
    const { renderVideo } = await import('@revideo/renderer');
    process.chdir(VIDEO_ROOT);
    preparePublicDir();
    const run = () =>
        renderVideo({
            projectFile: `./src/projects/${cut}.ts`,
            variables: encodeVariables(variables),
            settings: {
                outFile: outFile as `${string}.mov`,
                outDir: './out/masters',
                logProgress: false,
                projectSettings: { exporter: { name: '@revideo/core/ffmpeg', options: { format: 'proRes' } } },
                viteConfig: {
                    publicDir: 'out/public',
                    server: { fs: { allow: ['..'] } },
                    optimizeDeps: {
                        include: [
                            '@revideo/core',
                            '@revideo/2d',
                            '@revideo/2d/lib/jsx-dev-runtime',
                            '@revideo/renderer/lib/client/render',
                            '@lezer/javascript',
                            '@lezer/highlight',
                            '@codemirror/language'
                        ]
                    }
                }
            }
        });
    try {
        return await run();
    } catch (error) {
        // Revideo #353: when Vite optimises dependencies on the first load it reloads the page under Puppeteer. The
        // second run finds them optimised.
        if (!String(error).includes('Navigating frame was detached')) throw error;
        return await run();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { version: { type: 'string' } } });
    const cut = positionals[0] as Cut;
    const options: CutOptions = { version: values.version };
    const name = cut === 'release' ? `release-${options.version}` : cut;
    const file = await render(cut, await variablesFor(cut, options), `${name}.mov`);
    console.log(file);
    process.exit(0);
}
