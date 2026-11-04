const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'ng-prism',
    projects: [
        {
            displayName: 'ng-prism:node',
            preset: '../../jest.preset.js',
            testEnvironment: 'node',
            testPathIgnorePatterns: [
                '\\.browser\\.spec\\.ts$',
                '\\.tz\\.spec\\.ts$',
                'prism-url-state\\.service\\.spec\\.ts$',
                'prism-renderer\\.service\\.spec\\.ts$',
                'prism-persistence\\.service\\.spec\\.ts$',
                'prism-variant-bg\\.service\\.spec\\.ts$',
                'prism-canvas-bg-pill\\.component\\.spec\\.ts$'
            ],
            transform: {
                '^.+\\.[mc]?[tj]s$': ['@swc/jest', swcJestConfig]
            },
            transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@angular)'],
            moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
            moduleNameMapper: {
                '^ora$': '<rootDir>/src/__mocks__/ora.ts'
            },
            coverageDirectory: 'test-output/jest/coverage'
        },
        {
            displayName: 'ng-prism:browser',
            preset: '../../jest.preset.js',
            testEnvironment: 'jsdom',
            testMatch: [
                '**/*.browser.spec.ts',
                '**/prism-url-state.service.spec.ts',
                '**/prism-renderer.service.spec.ts',
                '**/prism-persistence.service.spec.ts',
                '**/prism-variant-bg.service.spec.ts',
                '**/prism-canvas-bg-pill.component.spec.ts'
            ],
            setupFiles: ['<rootDir>/src/test-setup-browser.ts'],
            transform: {
                '^.+\\.[mc]?[tj]s$': ['@swc/jest', swcJestConfig]
            },
            transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@angular)'],
            moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
            coverageDirectory: 'test-output/jest/coverage'
        },
        // What a Date does depends on the time zone: the same specs west and east of UTC.
        ...[
            ['tz-new-york', 'America/New_York'],
            ['tz-berlin', 'Europe/Berlin']
        ].map(([name, timezone]) => ({
            displayName: `ng-prism:${name}`,
            preset: '../../jest.preset.js',
            testEnvironment: '<rootDir>/jest.timezone-environment.cjs',
            testEnvironmentOptions: { timezone },
            testMatch: ['**/*.tz.spec.ts'],
            transform: {
                '^.+\\.[mc]?[tj]s$': ['@swc/jest', swcJestConfig]
            },
            transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@angular)'],
            moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
            coverageDirectory: 'test-output/jest/coverage'
        }))
    ]
};
