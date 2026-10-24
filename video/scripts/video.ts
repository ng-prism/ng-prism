// Builds the videos in one go: prerequisites, recordings, masters, exports. Each step is one of the other scripts in
// its own process; the first that fails stops the run, after printing its own message.
//
//   node scripts/video.ts                         the tour (out/deliver/ and the docs video)
//   node scripts/video.ts --release 22.7          the release clip only; the committed tour stays as it is
//   node scripts/video.ts --release 22.7 --tour   both
//   add --skip-record to reuse the recordings
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../src/lib/recordings.ts';
import { pipelineSteps } from './pipeline.ts';

const VIDEO_ROOT = join(REPO_ROOT, 'video');
const { values } = parseArgs({ options: { release: { type: 'string' }, tour: { type: 'boolean' }, 'skip-record': { type: 'boolean' } } });

for (const step of pipelineSteps({ release: values.release, tour: values.tour, skipRecord: values['skip-record'] })) {
    console.log(`\n▶ ${step.label}`);
    try {
        execFileSync(process.execPath, step.args, { cwd: VIDEO_ROOT, stdio: 'inherit' });
    } catch {
        console.error(`\nStopped at "${step.label}".`);
        process.exit(1);
    }
}
console.log('\nDone: see video/out/deliver/ (and docs/assets/video/ when the tour was built).');
