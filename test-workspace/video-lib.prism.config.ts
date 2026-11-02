// Prism config of video-lib, the demo library of the product films (skill prism-video). Committed, unlike
// ng-prism.config.ts, so every film lifts the same plugins and fixtures.
import { defineConfig } from '@ng-prism/core/config';
import { boxModelPlugin } from '@ng-prism/plugin-box-model';
import { coveragePlugin } from '@ng-prism/plugin-coverage';
import { jsDocPlugin } from '@ng-prism/plugin-jsdoc';
import { visualRegressionPlugin } from '@ng-prism/plugin-visual-regression';

export default defineConfig({
    plugins: [
        jsDocPlugin(),
        coveragePlugin({ coveragePath: 'projects/video-lib/fixtures/coverage-summary.json' }),
        boxModelPlugin(),
        visualRegressionPlugin({ reportPath: 'projects/video-lib/fixtures/vrt/vrt-report.json', assetBaseUrl: 'assets/' })
    ]
});
