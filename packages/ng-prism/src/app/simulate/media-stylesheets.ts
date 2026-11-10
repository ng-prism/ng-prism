import { isDevMode } from '@angular/core';
import {
    declarationsOf,
    hasStyle,
    isImportRule,
    isInheritable,
    isKeyframesRule,
    isMediaRule,
    isRuleGroup,
    isStyleRule,
    overlaps,
    prelude,
    propertyOf,
    rewriteDeclarations,
    type RuleGroup
} from './css-rules.js';
import { exemptionSelector, type ForcedColorRules, sameForcedColorRules } from './forced-colors.js';
import { type ForcedPaletteName, resolveSystemColors } from './forced-palette.js';
import { declarationsOfStyle, exemptTwin, forcedKeyframe, forcedTwin, keyframesTwinName, serializeDeclarations, type TwinContext } from './forced-values.js';
import { mentionsEmulated, substituteMedia } from './media-condition.js';
import { SCOPE_IN_SUFFIX, SCOPE_OUT_SUFFIX, scopeIn, scopeOut, SIM_SCOPE, splitList, targetsRoot, unscopeOut } from './scope-selector.js';
import { type EmulatedMedia, sameMedia } from './simulation.js';

/** The forced colors the engine simulates: the palette, and what the author's styles say about forced colors. */
export interface ForcedOptions {
    readonly palette: ForcedPaletteName;
    readonly rules: ForcedColorRules;
}

/**
 * Where a rule sits: in a sheet or a group (`top`), or nested in a style rule
 * whose subject is the document root (`root`) or not (`rule`). Inside a style
 * rule, `&` and bare declarations stand for its subject.
 */
type Nesting = 'top' | 'rule' | 'root';

/** What the engine did to one sheet, kept to be undone operation by operation. */
interface Rewrite {
    /** Every rule the engine inserted, with the group it went into. */
    readonly copies: Map<CSSRule, RuleGroup>;
    /** Every style rule taken out of the scope, with the selector it had. */
    readonly excluded: { rule: CSSStyleRule; original: string }[];
    /** Bare declarations taken out of the scope, with the rule that holds them now. */
    readonly moved: { group: RuleGroup; rule: CSSRule; declarations: string }[];
}

/** What the twins need while forced colors are simulated. */
interface Forcing {
    readonly context: TwinContext;
    /** What is exempt ({@link exemptionSelector}), `null` without an exemption. */
    readonly exemption: string | null;
    /** The condition of a twin that forces: not exempt, or nothing without an exemption. */
    readonly notExempt: string;
}

/** The scope roots. A nested `& :where(…)` reaches them from a rule on the document root. */
const SCOPE_ROOTS = `:where(${SIM_SCOPE})`;

/** How the rules nested in `rule` sit, given how `rule` sits. */
function nestingIn(rule: CSSStyleRule, nesting: Nesting): Nesting {
    return targetsRoot(rule.selectorText, nesting === 'root') ? 'root' : 'rule';
}

/** `&` restricted to the scope: what it matches in the scope, or the scope roots below the document root. */
function scopedParent(nesting: Nesting): string {
    return nesting === 'root' ? `& ${SCOPE_ROOTS}` : `&${SCOPE_IN_SUFFIX}`;
}

/**
 * Where the scope's version of a rule goes, and what it may set there: on the
 * scope roots, for a selector on the document root, only what they may inherit
 * ({@link isInheritable}); anywhere else, everything.
 */
interface ScopedTarget {
    /** The selector, given a condition that goes right behind the scope. */
    readonly selector: (extra: string) => string;
    readonly onRoot: boolean;
}

/**
 * A selector list as the selectors on the document root and the others, each a
 * list again, `null` where there is none; a list that does not mix the two stays
 * as it is written. `parentIsRoot` is as for {@link scopeIn}.
 */
function splitByRoot(selectorList: string, parentIsRoot: boolean): { root: string | null; others: string | null } {
    const root: string[] = [];
    const others: string[] = [];

    for (const part of splitList(selectorList)) if (part.trim() !== '') (targetsRoot(part, parentIsRoot) ? root : others).push(part.trim());
    if (root.length === 0) return { root: null, others: selectorList };
    if (others.length === 0) return { root: selectorList, others: null };
    return { root: root.join(', '), others: others.join(', ') };
}

/**
 * The targets of a style rule's own declarations in the scope: its selector
 * list scoped in, split where it mixes the document root with other selectors.
 * Every selector of a list has its own specificity, so the two weigh what the
 * list did; and the one for the root sets nothing the other does not, so where
 * both reach a scope root they agree.
 */
function ruleTargets(selectorList: string, parentIsRoot: boolean): ScopedTarget[] {
    const { root, others } = splitByRoot(selectorList, parentIsRoot);
    const targets: ScopedTarget[] = [];

    if (others !== null) targets.push({ selector: (extra) => scopeIn(others, parentIsRoot, extra), onRoot: false });
    if (root !== null) targets.push({ selector: (extra) => scopeIn(root, parentIsRoot, extra), onRoot: true });
    return targets;
}

/**
 * {@link ruleTargets} for the declarations of a rule with nested rules, which go
 * into a nested `&` ({@link scopedParent}): for the other selectors in the scope,
 * for the ones on the document root on the scope roots below it.
 */
function parentTargets(selectorList: string, parentIsRoot: boolean): ScopedTarget[] {
    const { root, others } = splitByRoot(selectorList, parentIsRoot);
    const targets: ScopedTarget[] = [];

    if (others !== null) targets.push({ selector: (extra) => `${scopedParent('rule')}${extra}`, onRoot: false });
    if (root !== null) targets.push({ selector: (extra) => `${scopedParent('root')}${extra}`, onRoot: true });
    return targets;
}

/** Whether `sheet` is one of `roots`, or imported by one of them at any depth. */
function reachable(sheet: CSSStyleSheet, roots: ReadonlySet<CSSStyleSheet>): boolean {
    for (let current: CSSStyleSheet | null | undefined = sheet; current; current = current.ownerRule?.parentStyleSheet) {
        if (roots.has(current)) return true;
    }
    return false;
}

function sameForced(a: ForcedOptions | null, b: ForcedOptions | null): boolean {
    return a === b || (a !== null && b !== null && a.palette === b.palette && sameForcedColorRules(a.rules, b.rules));
}

/**
 * The document's stylesheets, rewritten so that the simulation scope
 * ({@link SIM_SCOPE}) gets the emulated answer to media features while the rest
 * of the page keeps the real one.
 *
 * Every `@media` that tests an emulated feature, at any depth, gets a copy right
 * behind it: the emulated answer filled into its condition
 * ({@link substituteMedia}), its selectors moved into the scope ({@link scopeIn}).
 * The original's selectors leave the scope ({@link scopeOut}). The copy keeps the
 * original's place in the cascade and its specificity, so inside the scope it
 * wins and loses against the rules around it as the original does under the
 * real condition, and what the condition tests besides the emulated features,
 * such as a width, stays live.
 *
 * While forced colors are simulated, every style rule that sets a property the
 * browser forces gets a twin right behind it ({@link forcedTwin}): its selector
 * moved into the scope, the importance of each declaration its own, and the
 * values the browser forces. A twin and its original are next to each other in
 * the cascade, with the same weight, so each twin shadows its original exactly
 * and the twins win and lose against each other as the originals do, in a layer,
 * nested or `!important`. The copies get twins of their own, and the originals
 * they take out of the scope get none. A twin keeps off an exempt subtree
 * ({@link exemptionSelector}), which gets a second twin with the system colors of
 * the palette where the rule names one. `@keyframes` get a twin under another
 * name ({@link keyframesTwinName}), which the twins of the rules name instead.
 *
 * Copies, twins and exclusions are undone one by one rather than from a
 * snapshot, so a forced pseudo state that `PseudoStyleSheets` widened in between
 * survives, and a rule it widens after has its twin widened too.
 *
 * `document.head` is watched while something is emulated, so styles that arrive
 * later, through a lazily rendered component or a hot reload, are rewritten too.
 * A sheet that leaves the document, the styles of a component that is gone or
 * the old version of a hot reload, is undone and forgotten on the next pass. A
 * rule that names a `@keyframes` arriving in a later sheet keeps the name in its
 * twin: the twins of the rules that were there before are not built again.
 */
export class MediaStyleSheets {
    private readonly ignored = new WeakSet<CSSStyleSheet>();
    /** What was warned about, a sheet or a text: each warns once, whatever is emulated. */
    private readonly warned = new WeakSet<object>();
    private readonly warnedTexts = new Set<string>();
    private readonly awaitedLinks = new WeakSet<Element>();
    /** The sheets rewritten for the current emulation, with what was done to each. */
    private readonly sheets = new Map<CSSStyleSheet, Rewrite>();
    /** The inheritable properties that rules on the document root set under an emulated condition. */
    private readonly rootProperties = new Set<string>();
    /** The names of the `@keyframes` that have a twin, and the names of their twins. */
    private readonly keyframes = new Set<string>();
    private readonly keyframesTwins = new Set<string>();
    private emulated: EmulatedMedia | null = null;
    /** The forced colors of the current emulation, `null` while forced colors are off. */
    private forced: ForcedOptions | null = null;
    private forcing: Forcing | null = null;
    private observer: MutationObserver | null = null;
    private outSuffix: string | null = null;

    /**
     * `onNewStyles` is called after a pass that rewrote sheets the engine had
     * not seen before, with those sheets, on `apply` and when styles arrive
     * while it is active, for a caller that reads the document's styles as well.
     * Nothing follows the call in the pass, so it may apply again.
     */
    constructor(
        private readonly doc: Document,
        private readonly onNewStyles?: (sheets: readonly CSSStyleSheet[]) => void
    ) {}

    /**
     * Rewrites every sheet for `emulated`, and keeps doing so for new styles
     * until `clear()`. With `forced`, every rule that sets a forced property gets
     * its twin, and the copies have their system colors in the palette, as in the
     * real forced colors mode. Idempotent; a different `emulated`, palette or
     * rules builds everything anew.
     */
    apply(emulated: EmulatedMedia, forced: ForcedOptions | null = null): void {
        if (Object.values(emulated).every((value) => value === undefined)) {
            this.clear();
            return;
        }
        if (this.emulated && (!sameMedia(this.emulated, emulated) || !sameForced(this.forced, forced))) this.restore();
        this.emulated = { ...emulated };
        this.forced = forced;
        this.forcing = forced && this.forcingFor(forced);
        this.sync();
        if (this.observer || typeof MutationObserver === 'undefined' || !this.doc.head) return;
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.doc.head, { childList: true, subtree: true, characterData: true });
    }

    /** Removes every copy and twin, undoes every `scopeOut`, stops observing. */
    clear(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.emulated = null;
        this.forced = null;
        this.forcing = null;
        this.restore();
    }

    /** Marks a sheet the simulation owns (the forced-colors sheet), which is never rewritten. */
    ignore(sheet: CSSStyleSheet): void {
        this.ignored.add(sheet);
    }

    private forcingFor({ palette, rules }: ForcedOptions): Forcing {
        const exemption = exemptionSelector(rules);

        return {
            // The names of the @keyframes twins grow during a pass, before the rules that name them are twinned.
            context: { palette, gradientVars: new Set(rules.gradientVars), layerVars: new Set(rules.layerVars), keyframes: this.keyframes },
            exemption,
            notExempt: exemption === null ? '' : `:not(${exemption})`
        };
    }

    /** Rewrites the sheets that are new since the last call, and lets go of the ones that left the document. */
    private sync(): void {
        const emulated = this.emulated;

        if (!emulated) return;

        const roots = new Set([...Array.from(this.doc.styleSheets), ...(this.doc.adoptedStyleSheets ?? [])]);

        for (const [sheet, rewrite] of this.sheets) {
            if (reachable(sheet, roots)) continue;
            // Undone rather than only dropped: an adopted sheet can come back, and is taken as new then.
            this.undo(rewrite);
            this.sheets.delete(sheet);
        }

        const fresh = new Map<CSSStyleSheet, Rewrite>();

        for (const sheet of roots) this.take(sheet, emulated, fresh);
        // A `<link>` has no sheet until it has loaded.
        for (const link of Array.from(this.doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))) {
            if (link.sheet || this.awaitedLinks.has(link)) continue;
            this.awaitedLinks.add(link);
            link.addEventListener(
                'load',
                () => {
                    this.awaitedLinks.delete(link);
                    this.sync();
                },
                { once: true }
            );
        }

        const known = this.rootProperties.size;

        for (const sheet of fresh.keys()) this.collectRootProperties(sheet, emulated, 'top', false);
        // A set keeps the order of insertion, so what the fresh sheets added comes last.
        const added = new Set(Array.from(this.rootProperties).slice(known));

        // Every fresh sheet first, so that a rule finds the twin of a @keyframes in another sheet.
        for (const [sheet, rewrite] of fresh) this.twinKeyframes(rewrite, sheet);
        // A sheet done before only lacks root copies for what is new, a fresh one for everything.
        for (const [sheet, rewrite] of this.sheets) if (added.size > 0 && !fresh.has(sheet)) this.copyRootValues(rewrite, sheet, emulated, added, 'top');
        for (const [sheet, rewrite] of fresh) {
            this.emulateGroup(rewrite, sheet, emulated, 'top');
            this.copyRootValues(rewrite, sheet, emulated, this.rootProperties, 'top');
        }
        if (fresh.size > 0) this.onNewStyles?.(Array.from(fresh.keys()));
    }

    /** Adds `sheet` and the sheets it imports to `fresh`, unless they are ignored, done already or unreadable. */
    private take(sheet: CSSStyleSheet, emulated: EmulatedMedia, fresh: Map<CSSStyleSheet, Rewrite>): void {
        if (this.ignored.has(sheet) || this.sheets.has(sheet)) return;

        let rules: CSSRuleList;

        try {
            rules = sheet.cssRules;
        } catch (error) {
            // Anything else means the sheet has not loaded yet; the link's load listener comes back to it.
            if (error instanceof DOMException && error.name === 'SecurityError') {
                this.warnOnce(
                    sheet,
                    `Cannot simulate media features in ${sheet.href ?? 'a stylesheet'}: its rules are cross-origin and cannot be read. ` +
                        'Serve it from the same origin, or with CORS and a crossorigin attribute.'
                );
            }
            return;
        }

        const rewrite: Rewrite = { copies: new Map(), excluded: [], moved: [] };

        this.sheets.set(sheet, rewrite);
        fresh.set(sheet, rewrite);

        // A condition on the `<link>`, `<style>` or `@import` decides about the whole sheet, for the
        // scope as for the page: the rules of a sheet cannot be copied elsewhere without breaking its
        // relative URLs and its place in the cascade.
        const media = sheet.media?.mediaText ?? '';

        if (mentionsEmulated(media, emulated)) this.warnOnce(sheet, unanswerable(media, sheet.href ?? 'a <style> element'));
        for (const rule of Array.from(rules)) {
            if (!isImportRule(rule)) continue;
            if (mentionsEmulated(rule.media.mediaText, emulated)) {
                this.warnOnce(rule.styleSheet ?? rule, unanswerable(rule.media.mediaText, `@import ${rule.href}`));
            }
            if (rule.styleSheet) this.take(rule.styleSheet, emulated, fresh);
        }
    }

    /**
     * Emulates every `@media` in `group` that tests an emulated feature, at any
     * depth, and gives every other rule its twin while forced colors are
     * simulated. The originals that a copy takes out of the scope get no twin.
     */
    private emulateGroup(rewrite: Rewrite, group: RuleGroup, emulated: EmulatedMedia, nesting: Nesting): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            // A twin inserted as the first nested rule of the rule around it.
            if (rewrite.copies.has(rule)) continue;
            if (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated)) {
                // Copied before it is excluded, so the copy starts from the selectors as they were.
                const copy = this.insert(rewrite, group, i + 1, rule.cssText);

                if (!copy || !isRuleGroup(copy)) continue;
                this.scopeCopy(copy, emulated, nesting);
                this.exclude(rewrite, rule, nesting, true);
                i++;
                continue;
            }
            if (this.forcing && isStyleRule(rule)) {
                i += this.twinStyleRule(rewrite, group, i, rule, nesting);
            } else if (this.forcing && nesting !== 'top' && hasStyle(rule)) {
                // Bare declarations nested in a style rule apply wherever it matches.
                const twins = this.twinsOf(rule.style, [{ selector: (extra) => `${scopedParent(nesting)}${extra}`, onRoot: nesting === 'root' }]);

                i += this.insertTwins(rewrite, group, i + 1, twins, '&');
            }
            if (isRuleGroup(rule)) this.emulateGroup(rewrite, rule, emulated, isStyleRule(rule) ? nestingIn(rule, nesting) : nesting);
        }
    }

    /**
     * Puts the twins of a style rule right behind it or, for a rule with nested
     * rules, first among them: its declarations come before what is nested in
     * it, and so do their twins. Returns how many it put behind the rule in `group`.
     */
    private twinStyleRule(rewrite: Rewrite, group: RuleGroup, index: number, rule: CSSStyleRule, nesting: Nesting): number {
        const selector = rule.selectorText;

        if (isRuleGroup(rule) && rule.cssRules.length > 0) {
            this.insertTwins(rewrite, rule, 0, this.twinsOf(rule.style, parentTargets(selector, nesting === 'root')), selector);
            return 0;
        }
        return this.insertTwins(rewrite, group, index + 1, this.twinsOf(rule.style, ruleTargets(selector, nesting === 'root')), selector);
    }

    /**
     * The twins of the declarations of `style` for each of `targets`, as rules:
     * the one that forces them, for what is not exempt, and the one with the
     * system colors of the palette, for what is, where the declarations name one.
     * `[]` while forced colors are off and for a rule that forces nothing.
     *
     * Read from the declarations as they are, before the system colors of a copy
     * resolve in the palette: a resolved one is no system color any more, and
     * would be forced.
     */
    private twinsOf(style: CSSStyleDeclaration, targets: readonly ScopedTarget[]): string[] {
        const forcing = this.forcing;

        if (!forcing) return [];

        const read = declarationsOfStyle(style);
        const twins: string[] = [];

        for (const { selector, onRoot } of targets) {
            const declarations = onRoot ? read.filter(({ property }) => isInheritable(property)) : read;
            const twin = forcedTwin(declarations, forcing.context);

            if (twin.length > 0) twins.push(`${selector(forcing.notExempt)} { ${serializeDeclarations(twin)} }`);
            if (forcing.exemption === null) continue;

            const exempt = exemptTwin(declarations, forcing.context);

            if (exempt.length > 0) twins.push(`${selector(forcing.exemption)} { ${serializeDeclarations(exempt)} }`);
        }
        return twins;
    }

    /**
     * Inserts the twins `rules` of the rule with the selector `of` at `index` in
     * `group`, in order, and returns how many the browser took. With a `rewrite`
     * they are recorded to be undone; without one they go into a copy, which goes
     * as a whole. A twin the browser rejects is warned about once by the selector
     * of its rule: its own text changes with the palette and the exemptions.
     */
    private insertTwins(rewrite: Rewrite | null, group: RuleGroup, index: number, rules: readonly string[], of: string): number {
        const rejected = `Cannot force colors for "${of}": the browser does not accept it with the simulation scope added.`;
        let inserted = 0;

        for (const text of rules) {
            const taken = rewrite ? this.insert(rewrite, group, index + inserted, text, rejected) !== null : this.tryInsert(group, index + inserted, text, rejected);

            if (taken) inserted++;
        }
        return inserted;
    }

    /**
     * Puts the twin of every `@keyframes` in `group` that sets a forced property
     * right behind it, at any depth, and notes its name for the twins of the
     * rules that name it ({@link TwinContext.keyframes}).
     */
    private twinKeyframes(rewrite: Rewrite, group: RuleGroup): void {
        const forcing = this.forcing;

        if (!forcing) return;
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (isKeyframesRule(rule)) {
                const twin = keyframesTwin(rule, forcing.context);

                if (twin !== null && this.insert(rewrite, group, i + 1, twin)) {
                    this.keyframes.add(rule.name);
                    this.keyframesTwins.add(keyframesTwinName(rule.name));
                    i++;
                }
            } else if (isRuleGroup(rule)) {
                this.twinKeyframes(rewrite, rule);
            }
        }
    }

    /**
     * Turns a fresh copy into the scope's version of the original: the emulated
     * answers in its conditions, its rules in the scope, each followed by its
     * twins while forced colors are simulated. Every declaration keeps the
     * importance it has, and with it the cascade of the real mode.
     *
     * While there is a palette, the system colors of every copy resolve in it
     * ({@link resolveSystemColors}), as they do in the real mode, where a
     * keyword left as it is would resolve in the browser's normal palette.
     *
     * A rule like `@keyframes` or `@font-face` is dropped from the copy: it would
     * apply to the whole page, the shell included, and keeps its real condition.
     */
    private scopeCopy(group: CSSRule & RuleGroup, emulated: EmulatedMedia, nesting: Nesting): void {
        if (isMediaRule(group)) group.media.mediaText = substituteMedia(group.media.mediaText, emulated);
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];
            // How many rules stand for this one now, its twins included.
            let kept = 1;

            if (isStyleRule(rule)) {
                kept = this.scopeCopiedRule(group, i, rule, emulated, nesting);
            } else if (isRuleGroup(rule)) {
                this.scopeCopy(rule, emulated, nesting);
            } else if (nesting !== 'top' && hasStyle(rule)) {
                // Bare declarations apply wherever the parent matches: in the copy, only in the scope.
                const twins = this.twinsOf(rule.style, [{ selector: (extra) => `${scopedParent(nesting)}${extra}`, onRoot: nesting === 'root' }]);
                const declarations = this.copiedDeclarations(rule.style.cssText, nesting === 'root').text;

                group.deleteRule(i);
                kept = 0;
                if (declarations !== '' && this.tryInsert(group, i, `${scopedParent(nesting)} { ${declarations} }`)) {
                    kept = 1 + this.insertTwins(null, group, i + 1, twins, '&');
                }
            } else {
                const name = prelude(rule.cssText);

                // The twin of a @keyframes in the original came along with it, and goes with it.
                if (!(isKeyframesRule(rule) && this.keyframesTwins.has(rule.name))) {
                    this.warnOnce(name, `Not simulating "${name}": copied for the scope, it would apply to the whole page. It keeps its real condition.`);
                }
                group.deleteRule(i);
                kept = 0;
            }
            i += kept - 1;
        }
    }

    /**
     * Moves a style rule of a copy into the scope, with its twins behind it.
     * Returns how many rules stand for it now: none when it had to go, because
     * the browser rejected the scoped selector or nothing was left to set.
     *
     * A rule with nested rules keeps its selector, so that a nested `.b` still
     * matches in the scope below a `.theme` outside it; the rule's own
     * declarations move into a nested `&` restricted to the scope, their twins
     * behind them. A rule on the document root keeps only inheritable properties
     * ({@link isInheritable}). A list that mixes the document root with other
     * selectors is split, as its twin is ({@link ruleTargets}): the rule keeps the
     * other selectors and everything it sets, and a rule for the document root
     * follows it.
     */
    private scopeCopiedRule(group: RuleGroup, index: number, rule: CSSStyleRule, emulated: EmulatedMedia, nesting: Nesting): number {
        const original = rule.selectorText;
        const parentIsRoot = nesting === 'root';
        const cssText = rule.style.cssText;

        if (isRuleGroup(rule) && rule.cssRules.length > 0) {
            const targets = parentTargets(original, parentIsRoot);
            const twins = this.twinsOf(rule.style, targets);
            let at = 0;

            this.scopeCopy(rule, emulated, nestingIn(rule, nesting));
            rule.style.cssText = '';
            for (const { selector, onRoot } of targets) {
                const declarations = this.copiedDeclarations(cssText, onRoot).text;

                if (declarations !== '' && this.tryInsert(rule, at, `${selector('')} { ${declarations} }`)) at++;
            }
            if (at > 0) this.insertTwins(null, rule, at, twins, original);
            return 1;
        }

        const { root, others } = splitByRoot(original, parentIsRoot);
        const onRoot = others === null;
        const { text: declarations, changed } = this.copiedDeclarations(cssText, onRoot);
        const twins = this.twinsOf(rule.style, ruleTargets(original, parentIsRoot));

        rule.selectorText = scopeIn(others ?? original, parentIsRoot);
        if (rule.selectorText === original) {
            // The setter ignores a selector the engine does not accept.
            this.warnOnce(original, `Cannot simulate media features for "${original}": the browser does not accept it with the simulation scope added.`);
        }
        if (rule.selectorText === original || declarations === '') {
            group.deleteRule(index);
            return 0;
        }
        // Only where a declaration goes or a value changes: setting the text of every copy would cost as much as the rest of the pass.
        if (onRoot || changed) rule.style.cssText = declarations;

        let kept = 1;

        if (root !== null && others !== null) {
            const inherited = this.copiedDeclarations(cssText, true).text;

            if (inherited !== '' && this.tryInsert(group, index + 1, `${scopeIn(root, parentIsRoot)} { ${inherited} }`)) kept++;
        }
        return kept + this.insertTwins(null, group, index + kept, twins, original);
    }

    /**
     * The declarations of a copy, on the document root only the inheritable
     * ones and under a palette with their system colors resolved in it, and
     * whether a value changed.
     */
    private copiedDeclarations(cssText: string, onRoot: boolean): { text: string; changed: boolean } {
        const palette = this.forced?.palette;
        let changed = false;
        const text = rewriteDeclarations(cssText, {
            keep: onRoot ? isInheritable : undefined,
            value: palette
                ? (property, value) => {
                      const resolved = resolveSystemColors(property, value, palette);

                      changed ||= resolved !== value;
                      return resolved;
                  }
                : undefined
        });

        return { text, changed };
    }

    /**
     * Takes every rule in `group`, an original, out of the scope, nested ones
     * included. Bare declarations nested in a rule that stays in the scope
     * (`.btn { @media … { color: white } }`) have no selector to exclude by. They
     * move into an `&` rule excluded from the scope, in their place, which keeps
     * their order and, below a single selector, their specificity.
     */
    private exclude(rewrite: Rewrite, group: RuleGroup, nesting: Nesting, parentInScope: boolean): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (isStyleRule(rule)) {
                const inner = nestingIn(rule, nesting);
                const original = rule.selectorText;
                const excluded = scopeOut(original, nesting === 'root');

                if (excluded !== original) {
                    rule.selectorText = excluded;
                    // The setter ignores a selector the engine does not accept.
                    if (rule.selectorText !== original) rewrite.excluded.push({ rule, original });
                }
                // What is nested in an excluded rule is excluded with it.
                if (isRuleGroup(rule)) this.exclude(rewrite, rule, inner, false);
            } else if (isRuleGroup(rule)) {
                this.exclude(rewrite, rule, nesting, parentInScope);
            } else if (parentInScope && nesting === 'rule' && hasStyle(rule) && rule.style.cssText.trim() !== '') {
                const declarations = rule.style.cssText;

                // Inserted before the original goes, so that a rejection leaves the original in place.
                if (!this.tryInsert(group, i + 1, `&${SCOPE_OUT_SUFFIX} { ${declarations} }`)) continue;
                group.deleteRule(i);
                rewrite.moved.push({ group, rule: group.cssRules[i], declarations });
            }
        }
    }

    /** Collects the inheritable properties that rules on the document root set under an emulated condition. */
    private collectRootProperties(group: RuleGroup, emulated: EmulatedMedia, nesting: Nesting, emulatedHere: boolean): void {
        for (const rule of Array.from(group.cssRules)) {
            const inner = isStyleRule(rule) ? nestingIn(rule, nesting) : nesting;

            if (emulatedHere && inner === 'root' && hasStyle(rule)) {
                for (const property of declarationsOf(rule.style.cssText).map(propertyOf)) {
                    if (isInheritable(property)) this.rootProperties.add(property);
                }
            }
            if (isRuleGroup(rule)) {
                this.collectRootProperties(rule, emulated, inner, emulatedHere || (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated)));
            }
        }
    }

    /**
     * Sets a root value on the scope roots again, right behind each rule on the
     * document root that sets one of `properties` outside an emulated condition:
     * `:root { --bg: #fff }` gets `:root :where(…) { --bg: #fff }`. Without it the
     * scope would inherit `--bg` from a rule whose condition is really true but
     * emulated false, which its copy cannot take back.
     *
     * A rule with nested rules (`:root { @media … }`) gets the copy as its first
     * nested rule instead, so that it comes before the copies nested in it, as
     * its declarations come before the originals.
     *
     * Under forced colors, the copy goes between the rule and its twin, which
     * forces what the copy sets again as it forces the rule.
     */
    private copyRootValues(rewrite: Rewrite, group: RuleGroup, emulated: EmulatedMedia, properties: ReadonlySet<string>, nesting: Nesting): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (rewrite.copies.has(rule) || (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated))) continue;

            const inner = isStyleRule(rule) ? nestingIn(rule, nesting) : nesting;

            if (inner === 'root' && hasStyle(rule)) {
                const declarations = rewriteDeclarations(rule.style.cssText, { keep: (property) => isInheritable(property) && overlaps(property, properties) });

                if (declarations === '') {
                    // Nothing to copy.
                } else if (isStyleRule(rule) && isRuleGroup(rule) && rule.cssRules.length > 0) {
                    this.insert(rewrite, rule, 0, `& ${SCOPE_ROOTS} { ${declarations} }`);
                } else {
                    const selector = isStyleRule(rule) ? scopeIn(rule.selectorText, nesting === 'root') : `& ${SCOPE_ROOTS}`;

                    if (this.insert(rewrite, group, i + 1, `${selector} { ${declarations} }`)) i++;
                }
            }
            if (isRuleGroup(rule)) this.copyRootValues(rewrite, rule, emulated, properties, inner);
        }
    }

    /** Inserts a rule of the engine's own, which {@link undo} removes again. */
    private insert(rewrite: Rewrite, group: RuleGroup, index: number, text: string, rejected?: string): CSSRule | null {
        if (!this.tryInsert(group, index, text, rejected)) return null;

        const rule = group.cssRules[index];

        rewrite.copies.set(rule, group);
        return rule;
    }

    /** Inserts `text`, or warns once in dev mode, with `rejected` or else about the text, and says no. */
    private tryInsert(group: RuleGroup, index: number, text: string, rejected?: string): boolean {
        try {
            group.insertRule(text, index);
            return true;
        } catch {
            const message = rejected ?? `Could not add a rule for the simulation: ${prelude(text)}`;

            this.warnOnce(message, message);
            return false;
        }
    }

    /** Undoes every sheet and forgets what was found in them. */
    private restore(): void {
        for (const rewrite of this.sheets.values()) this.undo(rewrite);
        this.sheets.clear();
        this.rootProperties.clear();
        this.keyframes.clear();
        this.keyframesTwins.clear();
    }

    /**
     * Removes the copies, puts moved declarations back and gives every excluded rule its selector back.
     *
     * The rules of each group are read once, not once per copy: a sheet with
     * thousands of emulated rules is undone on every change of the menu.
     */
    private undo(rewrite: Rewrite): void {
        const copiesIn = new Map<RuleGroup, Set<CSSRule>>();

        for (const [rule, group] of rewrite.copies) {
            const copies = copiesIn.get(group);

            if (copies) copies.add(rule);
            else copiesIn.set(group, new Set([rule]));
        }
        for (const [group, copies] of copiesIn) {
            const rules = group.cssRules;

            // From the end, so that a deletion moves none of the rules still to look at.
            for (let i = rules.length - 1; i >= 0; i--) if (copies.has(rules[i])) group.deleteRule(i);
        }

        // Each one is put back in its place, which moves no other rule of its group.
        const indexes = new Map<RuleGroup, Map<CSSRule, number>>();

        for (const { group, rule, declarations } of rewrite.moved) {
            let index = indexes.get(group);

            if (!index) {
                index = new Map(Array.from(group.cssRules, (each, i) => [each, i]));
                indexes.set(group, index);
            }

            const at = index.get(rule);

            if (at === undefined) continue;
            try {
                group.insertRule(declarations, at);
                group.deleteRule(at + 1);
            } catch {
                // An engine that takes no bare declarations through insertRule keeps them in `& { … }`.
                (rule as CSSStyleRule).selectorText = '&';
            }
        }

        for (const { rule, original } of rewrite.excluded) {
            const current = rule.selectorText;
            const restored = unscopeOut(current, this.serialisedOutSuffix());

            if (restored !== current) {
                rule.selectorText = restored;
            } else if (current !== original) {
                // Written back in a form the probe did not predict; what changed the selector since is lost.
                if (isDevMode()) console.warn(`[ng-prism] Could not find the simulation scope in "${current}", restored "${original}".`);
                rule.selectorText = original;
            }
        }
    }

    /**
     * {@link SCOPE_OUT_SUFFIX} as this engine writes it back into `selectorText`,
     * which need not be the way it was set: learned once, from a probe rule in a
     * sheet of its own.
     */
    private serialisedOutSuffix(): string {
        if (this.outSuffix !== null) return this.outSuffix;
        this.outSuffix = SCOPE_OUT_SUFFIX;
        try {
            const View = this.doc.defaultView?.CSSStyleSheet;
            const probe = View ? new View() : null;

            probe?.insertRule('.p {}', 0);
            const rule = probe?.cssRules[0] as CSSStyleRule | undefined;

            if (rule) {
                rule.selectorText = `.p${SCOPE_OUT_SUFFIX}`;
                if (rule.selectorText.startsWith('.p:')) this.outSuffix = rule.selectorText.slice(2);
            }
        } catch {
            // No constructable sheets: the suffix is looked for as it was written.
        }
        return this.outSuffix;
    }

    private warnOnce(about: object | string, message: string): void {
        if (typeof about === 'string' ? this.warnedTexts.has(about) : this.warned.has(about)) return;
        if (typeof about === 'string') this.warnedTexts.add(about);
        else this.warned.add(about);
        if (isDevMode()) console.warn(`[ng-prism] ${message}`);
    }
}

/**
 * The twin of a `@keyframes` under its own name ({@link keyframesTwinName}), each
 * keyframe with the forced values in place of the ones the browser forces and the
 * rest as it is ({@link forcedKeyframe}); `null` if no keyframe sets a forced property.
 */
function keyframesTwin(rule: CSSKeyframesRule, context: TwinContext): string | null {
    let forces = false;
    const frames = Array.from(rule.cssRules, (frame) => {
        const { keyText, style } = frame as CSSKeyframeRule;
        const declarations = declarationsOfStyle(style, { all: true });

        forces ||= forcedTwin(declarations, context).length > 0;
        return `${keyText} { ${serializeDeclarations(forcedKeyframe(declarations, context))} }`;
    });

    return forces ? `@keyframes ${keyframesTwinName(rule.name)} { ${frames.join(' ')} }` : null;
}

function unanswerable(media: string, where: string): string {
    return (
        `Cannot simulate "${media}" for ${where}: a condition on a <link>, <style> or @import keeps its real answer. ` +
        'Put it in an @media rule inside the stylesheet instead.'
    );
}
