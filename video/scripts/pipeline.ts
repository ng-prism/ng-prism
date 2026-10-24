// The steps of `npm run video`, each one of the other scripts. Pure, so tested.

export interface PipelineOptions {
    /** Build the release clip of this version. */
    release?: string;
    /** Build the tour as well when `release` is set; without `release` the tour is always built. */
    tour?: boolean;
    /** Reuse the recordings instead of making new ones. */
    skipRecord?: boolean;
}

export interface PipelineStep {
    label: string;
    args: string[];
}

/**
 * The scripts to run, in order. The tour is built only when asked for or when no release is: its export rewrites the
 * committed `docs/assets/video/tour.mp4`, which a release clip must not touch.
 */
export function pipelineSteps({ release, tour, skipRecord }: PipelineOptions): PipelineStep[] {
    return [
        { label: 'Prerequisites', args: ['scripts/prereqs.ts'] },
        ...(skipRecord ? [] : [{ label: 'Recordings', args: ['record/record.ts'] }]),
        ...(tour || !release
            ? [
                  { label: 'Tour', args: ['scripts/render.ts', 'tour'] },
                  { label: 'Tour export', args: ['scripts/export.ts', 'tour'] }
              ]
            : []),
        ...(release
            ? [
                  { label: `Release ${release}`, args: ['scripts/render.ts', 'release', '--version', release] },
                  { label: `Release ${release} export`, args: ['scripts/export.ts', `release-${release}`] }
              ]
            : [])
    ];
}
