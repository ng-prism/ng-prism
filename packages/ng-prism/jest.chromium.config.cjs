const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

// The specs that compare the simulation with Chromium's real modes. They start
// Chromium through Playwright, so they run as their own target, `test-chromium`,
// and not in `test`: in CI, `test` runs on Nx Cloud agents that have no Chromium.
module.exports = {
    displayName: 'ng-prism:chromium',
    preset: '../../jest.preset.js',
    testEnvironment: 'node',
    testMatch: ['**/*.chromium.spec.ts'],
    testTimeout: 30000,
    transform: {
        '^.+\\.[mc]?[tj]s$': ['@swc/jest', swcJestConfig]
    },
    transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@angular)'],
    moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
    coverageDirectory: 'test-output/jest/coverage'
};
