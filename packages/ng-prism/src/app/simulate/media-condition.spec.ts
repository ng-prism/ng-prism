import { MEDIA_FALSE, MEDIA_TRUE, mentionsEmulated, substituteMedia } from './media-condition.js';
import type { EmulatedMedia } from './simulation.js';

const reduce: EmulatedMedia = { 'prefers-reduced-motion': 'reduce' };

describe('substituteMedia', () => {
    it('replaces each emulated feature test, keeps the rest live', () => {
        expect(substituteMedia('(prefers-reduced-motion: reduce)', reduce)).toBe(MEDIA_TRUE);
        expect(substituteMedia('(prefers-reduced-motion: no-preference)', reduce)).toBe(MEDIA_FALSE);
        expect(substituteMedia('(prefers-reduced-motion)', reduce)).toBe(MEDIA_TRUE);
        expect(substituteMedia('screen and (prefers-reduced-motion: reduce) and (min-width: 600px)', reduce)).toBe(`screen and ${MEDIA_TRUE} and (min-width: 600px)`);
        expect(substituteMedia('not all and (prefers-color-scheme: dark)', { 'prefers-color-scheme': 'light' })).toBe(`not all and ${MEDIA_FALSE}`);
        expect(substituteMedia('(forced-colors: active), print', { 'forced-colors': 'active' })).toBe(`${MEDIA_TRUE}, print`);
        expect(substituteMedia('(forced-colors: none)', { 'forced-colors': 'active' })).toBe(MEDIA_FALSE);
        expect(substituteMedia('(PREFERS-COLOR-SCHEME:dark)', { 'prefers-color-scheme': 'dark' })).toBe(MEDIA_TRUE);
    });

    it('leaves features that are not emulated alone', () => {
        expect(substituteMedia('(prefers-color-scheme: dark)', reduce)).toBe('(prefers-color-scheme: dark)');
        expect(substituteMedia('(prefers-reduced-motion: reduce)', {})).toBe('(prefers-reduced-motion: reduce)');
        expect(substituteMedia('(prefers-contrast: more) and (hover: hover)', { 'forced-colors': 'active' })).toBe('(prefers-contrast: more) and (hover: hover)');
    });

    it('is tolerant of case and whitespace in the feature test', () => {
        const dark: EmulatedMedia = { 'prefers-color-scheme': 'dark' };

        expect(substituteMedia('( prefers-color-scheme : dark )', dark)).toBe(MEDIA_TRUE);
        expect(substituteMedia('(Prefers-Color-Scheme: DARK)', dark)).toBe(MEDIA_TRUE);
        expect(substituteMedia('(prefers-color-scheme:\n  light)', dark)).toBe(MEDIA_FALSE);
        expect(substituteMedia('(  prefers-color-scheme  )', dark)).toBe(MEDIA_TRUE);
    });

    it('replaces every emulated test of a query, whatever the feature', () => {
        const both: EmulatedMedia = { 'prefers-reduced-motion': 'reduce', 'prefers-color-scheme': 'dark' };

        expect(substituteMedia('(prefers-color-scheme: dark) and (prefers-reduced-motion: no-preference), (prefers-reduced-motion)', both)).toBe(
            `${MEDIA_TRUE} and ${MEDIA_FALSE}, ${MEDIA_TRUE}`
        );
        expect(substituteMedia('(prefers-reduced-motion: reduce) and (prefers-reduced-motion: reduce)', reduce)).toBe(`${MEDIA_TRUE} and ${MEDIA_TRUE}`);
    });

    it('answers the boolean context true for every value an emulation can take', () => {
        expect(substituteMedia('(prefers-color-scheme)', { 'prefers-color-scheme': 'light' })).toBe(MEDIA_TRUE);
        expect(substituteMedia('(forced-colors)', { 'forced-colors': 'active' })).toBe(MEDIA_TRUE);
    });

    it('keeps not and only in front of a substituted test valid', () => {
        expect(substituteMedia('not (prefers-reduced-motion: reduce)', reduce)).toBe(`not ${MEDIA_TRUE}`);
        expect(substituteMedia('only screen and (prefers-reduced-motion: no-preference)', reduce)).toBe(`only screen and ${MEDIA_FALSE}`);
    });

    it('never matches a feature test that merely starts like an emulated one', () => {
        expect(substituteMedia('(prefers-color-scheme-x: dark)', { 'prefers-color-scheme': 'dark' })).toBe('(prefers-color-scheme-x: dark)');
    });
});

describe('mentionsEmulated', () => {
    it('is true for a query that tests an emulated feature', () => {
        expect(mentionsEmulated('screen and (prefers-reduced-motion)', reduce)).toBe(true);
        expect(mentionsEmulated('(PREFERS-REDUCED-MOTION : reduce)', reduce)).toBe(true);
        expect(mentionsEmulated('print, (prefers-reduced-motion: no-preference)', reduce)).toBe(true);
    });

    it('is false for features that are not emulated', () => {
        expect(mentionsEmulated('(prefers-color-scheme: dark)', reduce)).toBe(false);
        expect(mentionsEmulated('(prefers-reduced-motion: reduce)', {})).toBe(false);
        expect(mentionsEmulated('screen and (min-width: 600px)', reduce)).toBe(false);
    });

    it('is true when only one of several emulated features is tested', () => {
        expect(mentionsEmulated('(forced-colors: active)', { 'prefers-reduced-motion': 'reduce', 'forced-colors': 'active' })).toBe(true);
    });

    it('agrees with substituteMedia on whether anything changes', () => {
        const queries = ['(prefers-reduced-motion: reduce)', '(prefers-color-scheme: dark)', 'screen and (min-width: 600px)', '(forced-colors)'];

        for (const query of queries) {
            expect(mentionsEmulated(query, reduce)).toBe(substituteMedia(query, reduce) !== query);
        }
    });
});
