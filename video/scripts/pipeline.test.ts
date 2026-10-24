import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pipelineSteps } from './pipeline.ts';

const labels = (options: Parameters<typeof pipelineSteps>[0]) => pipelineSteps(options).map((step) => step.label);

test('without options the pipeline records and builds the tour, which also updates the docs video', () => {
    assert.deepEqual(labels({}), ['Prerequisites', 'Recordings', 'Tour', 'Tour export']);
});

test('a release run builds only the release clip and leaves the committed tour alone', () => {
    assert.deepEqual(labels({ release: '22.8' }), ['Prerequisites', 'Recordings', 'Release 22.8', 'Release 22.8 export']);
});

test('--tour with --release builds both, and --skip-record reuses the recordings', () => {
    assert.deepEqual(labels({ release: '22.8', tour: true, skipRecord: true }), ['Prerequisites', 'Tour', 'Tour export', 'Release 22.8', 'Release 22.8 export']);
});

test('each step runs one of the scripts with its arguments', () => {
    assert.deepEqual(
        pipelineSteps({ release: '22.8' }).map((step) => step.args),
        [['scripts/prereqs.ts'], ['record/record.ts'], ['scripts/render.ts', 'release', '--version', '22.8'], ['scripts/export.ts', 'release-22.8']]
    );
});
