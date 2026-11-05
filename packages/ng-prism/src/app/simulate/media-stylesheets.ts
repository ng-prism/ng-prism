import { isDevMode } from '@angular/core';
import {
    declarationsOf,
    hasStyle,
    isImportRule,
    isInheritable,
    isMediaRule,
    isRuleGroup,
    isStyleRule,
    overlaps,
    prelude,
    propertyOf,
    rewriteDeclarations,
    type RuleGroup
} from './css-rules.js';
import { isForced } from './forced-colors.js';
import { mentionsEmulated, substituteMedia } from './media-condition.js';
import { SCOPE_IN_SUFFIX, SCOPE_OUT_SUFFIX, scopeIn, scopeOut, SIM_SCOPE, targetsRoot, unscopeOut } from './scope-selector.js';
import { type EmulatedMedia, sameMedia } from './simulation.js';

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

/** Whether `sheet` is one of `roots`, or imported by one of them at any depth. */
function reachable(sheet: CSSStyleSheet, roots: ReadonlySet<CSSStyleSheet>): boolean {
    for (let current: CSSStyleSheet | null | undefined = sheet; current; current = current.ownerRule?.parentStyleSheet) {
        if (roots.has(current)) return true;
    }
    return false;
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
 * Copies and exclusions are undone one by one rather than from a snapshot, so a
 * forced pseudo state that `PseudoStyleSheets` widened in between survives.
 *
 * `document.head` is watched while something is emulated, so styles that arrive
 * later, through a lazily rendered component or a hot reload, are rewritten too.
 * A sheet that leaves the document, the styles of a component that is gone or
 * the old version of a hot reload, is undone and forgotten on the next pass.
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
    private emulated: EmulatedMedia | null = null;
    private observer: MutationObserver | null = null;
    private outSuffix: string | null = null;

    /**
     * `onNewStyles` is called after a pass that rewrote sheets the engine had
     * not seen before, on `apply` and when styles arrive while it is active, for
     * a caller that reads the document's styles as well.
     */
    constructor(
        private readonly doc: Document,
        private readonly onNewStyles?: () => void
    ) {}

    /** Rewrites every sheet for `emulated`, and keeps doing so for new styles until `clear()`. Idempotent; a different `emulated` re-applies. */
    apply(emulated: EmulatedMedia): void {
        if (Object.values(emulated).every((value) => value === undefined)) {
            this.clear();
            return;
        }
        if (this.emulated && !sameMedia(this.emulated, emulated)) this.restore();
        this.emulated = { ...emulated };
        this.sync();
        if (this.observer || typeof MutationObserver === 'undefined' || !this.doc.head) return;
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.doc.head, { childList: true, subtree: true, characterData: true });
    }

    /** Removes every copy, undoes every `scopeOut`, stops observing. */
    clear(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.emulated = null;
        this.restore();
    }

    /** Marks a sheet the simulation owns (the forced-colors sheet), which is never rewritten. */
    ignore(sheet: CSSStyleSheet): void {
        this.ignored.add(sheet);
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

        // A sheet done before only lacks root copies for what is new, a fresh one for everything.
        for (const [sheet, rewrite] of this.sheets) if (added.size > 0 && !fresh.has(sheet)) this.copyRootValues(rewrite, sheet, emulated, added, 'top');
        for (const [sheet, rewrite] of fresh) {
            this.emulateGroup(rewrite, sheet, emulated, 'top');
            this.copyRootValues(rewrite, sheet, emulated, this.rootProperties, 'top');
        }
        if (fresh.size > 0) this.onNewStyles?.();
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

    /** Emulates every `@media` in `group` that tests an emulated feature, at any depth. */
    private emulateGroup(rewrite: Rewrite, group: RuleGroup, emulated: EmulatedMedia, nesting: Nesting): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated)) {
                // Copied before it is excluded, so the copy starts from the selectors as they were.
                const copy = this.insert(rewrite, group, i + 1, rule.cssText);

                if (!copy || !isRuleGroup(copy)) continue;
                this.scopeCopy(copy, emulated, nesting, false);
                this.exclude(rewrite, rule, nesting, true);
                i++;
            } else if (isRuleGroup(rule)) {
                this.emulateGroup(rewrite, rule, emulated, isStyleRule(rule) ? nestingIn(rule, nesting) : nesting);
            }
        }
    }

    /**
     * Turns a fresh copy into the scope's version of the original: the emulated
     * answers in its conditions, its rules in the scope. Under `forced-colors`,
     * every declaration of a property the forced sheet sets ({@link isForced})
     * becomes `!important`, so that the author's colours for the mode win against
     * the palette the simulation forces, as they do in the real mode. Everything
     * else keeps the weight it has, and with it the cascade of the real mode.
     *
     * A rule like `@keyframes` or `@font-face` is dropped from the copy: it would
     * apply to the whole page, the shell included, and keeps its real condition.
     */
    private scopeCopy(group: CSSRule & RuleGroup, emulated: EmulatedMedia, nesting: Nesting, forced: boolean): void {
        if (isMediaRule(group)) {
            const forcedColors = emulated['forced-colors'];

            forced ||= forcedColors !== undefined && mentionsEmulated(group.media.mediaText, { 'forced-colors': forcedColors });
            group.media.mediaText = substituteMedia(group.media.mediaText, emulated);
        }
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];
            let kept = true;

            if (isStyleRule(rule)) {
                kept = this.scopeCopiedRule(group, i, rule, emulated, nesting, forced);
            } else if (isRuleGroup(rule)) {
                this.scopeCopy(rule, emulated, nesting, forced);
            } else if (nesting !== 'top' && hasStyle(rule)) {
                // Bare declarations apply wherever the parent matches: in the copy, only in the scope.
                const declarations = rewriteDeclarations(rule.style.cssText, {
                    keep: nesting === 'root' ? isInheritable : undefined,
                    important: forced ? isForced : undefined
                });

                group.deleteRule(i);
                kept = declarations !== '' && this.tryInsert(group, i, `${scopedParent(nesting)} { ${declarations} }`);
            } else {
                const name = prelude(rule.cssText);

                this.warnOnce(name, `Not simulating "${name}": copied for the scope, it would apply to the whole page. It keeps its real condition.`);
                group.deleteRule(i);
                kept = false;
            }
            if (!kept) i--;
        }
    }

    /**
     * Moves a style rule of a copy into the scope. Returns false when the rule
     * had to go instead: the browser rejected the scoped selector, or nothing
     * was left to set.
     *
     * A rule with nested rules keeps its selector, so that a nested `.b` still
     * matches in the scope below a `.theme` outside it; the rule's own
     * declarations move into a nested `&` restricted to the scope. A rule on the
     * document root keeps only inheritable properties ({@link isInheritable}).
     */
    private scopeCopiedRule(group: RuleGroup, index: number, rule: CSSStyleRule, emulated: EmulatedMedia, nesting: Nesting, forced: boolean): boolean {
        const inner = nestingIn(rule, nesting);
        const declarations = rewriteDeclarations(rule.style.cssText, { keep: inner === 'root' ? isInheritable : undefined, important: forced ? isForced : undefined });

        if (isRuleGroup(rule) && rule.cssRules.length > 0) {
            this.scopeCopy(rule, emulated, inner, forced);
            rule.style.cssText = '';
            if (declarations !== '') this.tryInsert(rule, 0, `${scopedParent(inner)} { ${declarations} }`);
            return true;
        }

        const original = rule.selectorText;

        rule.selectorText = scopeIn(original, nesting === 'root');
        if (rule.selectorText === original) {
            // The setter ignores a selector the engine does not accept.
            this.warnOnce(original, `Cannot simulate media features for "${original}": the browser does not accept it with the simulation scope added.`);
        }
        if (rule.selectorText === original || declarations === '') {
            group.deleteRule(index);
            return false;
        }
        if (inner === 'root' || forced) rule.style.cssText = declarations;
        return true;
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
    private insert(rewrite: Rewrite, group: RuleGroup, index: number, text: string): CSSRule | null {
        if (!this.tryInsert(group, index, text)) return null;

        const rule = group.cssRules[index];

        rewrite.copies.set(rule, group);
        return rule;
    }

    /** Inserts `text`, or warns once per text in dev mode and says no. */
    private tryInsert(group: RuleGroup, index: number, text: string): boolean {
        try {
            group.insertRule(text, index);
            return true;
        } catch {
            this.warnOnce(text, `Could not add a rule for the simulation: ${prelude(text)}`);
            return false;
        }
    }

    /** Undoes every sheet and forgets what was found in them. */
    private restore(): void {
        for (const rewrite of this.sheets.values()) this.undo(rewrite);
        this.sheets.clear();
        this.rootProperties.clear();
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

function unanswerable(media: string, where: string): string {
    return (
        `Cannot simulate "${media}" for ${where}: a condition on a <link>, <style> or @import keeps its real answer. ` +
        'Put it in an @media rule inside the stylesheet instead.'
    );
}
