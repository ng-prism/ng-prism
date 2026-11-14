const { TestEnvironment } = require('jest-environment-node');

/**
 * The Node environment in the time zone `testEnvironmentOptions.timezone` names, for the `*.tz.spec.ts` that check what a
 * `Date` does in more than one zone. `TZ` is set on the worker, outside the sandbox, before the spec runs: Node takes a
 * new `TZ` at once, for the sandbox's `Date` too. The spec reads the zone as `__PRISM_TIMEZONE__`.
 */
class TimezoneEnvironment extends TestEnvironment {
    constructor(config, context) {
        super(config, context);
        const { timezone } = config.projectConfig.testEnvironmentOptions;

        this.previousTimezone = process.env.TZ;
        process.env.TZ = timezone;
        this.global.__PRISM_TIMEZONE__ = timezone;
    }

    async teardown() {
        if (this.previousTimezone === undefined) delete process.env.TZ;
        else process.env.TZ = this.previousTimezone;
        await super.teardown();
    }
}

module.exports = TimezoneEnvironment;
