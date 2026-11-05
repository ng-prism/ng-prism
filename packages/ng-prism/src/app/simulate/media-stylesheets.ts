import { isDevMode } from '@angular/core';
import { stringEnd } from '../pseudo/pseudo-selector.js';
import { mentionsEmulated, substituteMedia } from './media-condition.js';
import { SCOPE_IN_SUFFIX, SCOPE_OUT_SUFFIX, scopeIn, scopeOut, SIM_SCOPE, targetsRoot, unscopeOut } from './scope-selector.js';
import type { EmulatedMedia } from './simulation.js';

/** A stylesheet or a grouping rule: anything rules can be inserted into. */
interface RuleGroup {
    readonly cssRules: CSSRuleList;
    insertRule(rule: string, index?: number): number;
    deleteRule(index: number): void;
}

/** The scope roots, for bare declarations nested in a rule on the document root (`& :where(…)`). */
const SCOPE_ROOTS = `:where(${SIM_SCOPE})`;

// Duck-typed rather than `instanceof`, as in pseudo-stylesheets.ts: the
// constructors belong to the window that owns the sheet, and not every engine
// has all of them.
function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
    return typeof (rule as Partial<CSSStyleRule>).selectorText === 'string' && 'style' in rule;
}

// `@media`, `@supports`, `@layer`, `@container`, and a style rule with nested
// rules. `@keyframes` takes new rules through `appendRule` and holds no selectors.
function isRuleGroup(rule: CSSRule): rule is CSSRule & RuleGroup {
    return 'cssRules' in rule && typeof (rule as Partial<CSSGroupingRule>).insertRule === 'function';
}

function isMediaRule(rule: CSSRule): rule is CSSMediaRule {
    return isRuleGroup(rule) && 'media' in rule;
}

function isImportRule(rule: CSSRule): rule is CSSImportRule {
    return 'styleSheet' in rule && 'href' in rule;
}

/** A style rule, or the bare declarations of an `@media` nested in one (`CSSNestedDeclarations`). */
function hasStyle(rule: CSSRule): rule is CSSRule & { readonly style: CSSStyleDeclaration } {
    return 'style' in rule;
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
 */
export class MediaStyleSheets {
    private readonly ignored = new WeakSet<CSSStyleSheet>();
    /** What was warned about: each stylesheet warns once, whatever is emulated. */
    private readonly warned = new WeakSet<object>();
    private readonly awaitedLinks = new WeakSet<Element>();
    /** The sheets rewritten for the current emulation. */
    private readonly sheets = new Set<CSSStyleSheet>();
    /** Every rule the engine inserted, with the group it went into. */
    private readonly copies = new Map<CSSRule, RuleGroup>();
    /** Every style rule taken out of the scope, with the selector it had. */
    private excluded: { rule: CSSStyleRule; original: string }[] = [];
    /** What rules on the document root set under an emulated condition. */
    private readonly rootProperties = new Set<string>();
    private emulated: EmulatedMedia | null = null;
    private observer: MutationObserver | null = null;
    private outSuffix: string | null = null;

    constructor(private readonly doc: Document) {}

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

    /** Rewrites the sheets that are new since the last call. */
    private sync(): void {
        const emulated = this.emulated;

        if (!emulated) return;

        const fresh: CSSStyleSheet[] = [];

        for (const sheet of Array.from(this.doc.styleSheets)) this.take(sheet, emulated, fresh);
        for (const sheet of this.doc.adoptedStyleSheets ?? []) this.take(sheet, emulated, fresh);
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

        for (const sheet of fresh) this.collectRootProperties(sheet, emulated, null, false);
        // A set keeps the order of insertion, so what the fresh sheets added comes last.
        const added = new Set(Array.from(this.rootProperties).slice(known));

        // A sheet done before only lacks root copies for what is new, a fresh one for everything.
        for (const sheet of this.sheets) if (added.size > 0 && !fresh.includes(sheet)) this.copyRootValues(sheet, emulated, added);
        for (const sheet of fresh) {
            this.emulateGroup(sheet, emulated, null);
            this.copyRootValues(sheet, emulated, this.rootProperties);
        }
    }

    /** Adds `sheet` and the sheets it imports to `fresh`, unless they are ignored, done already or unreadable. */
    private take(sheet: CSSStyleSheet, emulated: EmulatedMedia, fresh: CSSStyleSheet[]): void {
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

        this.sheets.add(sheet);
        fresh.push(sheet);

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
     * depth. `parent` is the selector of the style rule `group` is nested in.
     */
    private emulateGroup(group: RuleGroup, emulated: EmulatedMedia, parent: string | null): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated)) {
                // Copied before it is excluded, so the copy starts from the selectors as they were.
                const copy = this.insert(group, i + 1, rule.cssText);

                if (!copy || !isRuleGroup(copy)) continue;
                this.scopeCopy(copy, emulated, parent, false);
                this.exclude(rule);
                i++;
            } else if (isRuleGroup(rule)) {
                this.emulateGroup(rule, emulated, isStyleRule(rule) ? rule.selectorText : parent);
            }
        }
    }

    /**
     * Turns a fresh copy into the scope's version of the original: the emulated
     * answers in its conditions, its rules in the scope. Under `forced-colors`,
     * every declaration becomes `!important`, so that the author's rules for the
     * mode win against the palette the simulation forces, as they do in the real
     * mode. `outer` is the selector of the style rule the copy is nested in, as
     * long as no style rule of the copy lies in between.
     */
    private scopeCopy(group: CSSRule & RuleGroup, emulated: EmulatedMedia, outer: string | null, forced: boolean): void {
        if (isMediaRule(group)) {
            const forcedColors = emulated['forced-colors'];

            forced ||= forcedColors !== undefined && mentionsEmulated(group.media.mediaText, { 'forced-colors': forcedColors });
            group.media.mediaText = substituteMedia(group.media.mediaText, emulated);
        }
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (isStyleRule(rule)) {
                rule.selectorText = scopeIn(rule.selectorText);
                if (forced) rule.style.cssText = important(rule.style.cssText);
            } else if (outer !== null && hasStyle(rule)) {
                // Bare declarations apply to what the outer rule matches, everywhere: in the copy,
                // they go into a rule of their own that matches it in the scope only.
                const selector = targetsRoot(outer) ? `& ${SCOPE_ROOTS}` : `&${SCOPE_IN_SUFFIX}`;
                const declarations = forced ? important(rule.style.cssText) : rule.style.cssText;

                group.deleteRule(i);
                group.insertRule(`${selector} { ${declarations} }`, i);
                continue;
            }
            if (isRuleGroup(rule)) this.scopeCopy(rule, emulated, isStyleRule(rule) ? null : outer, forced);
        }
    }

    /** Takes every style rule in `group` out of the scope, nested ones included. */
    private exclude(group: RuleGroup): void {
        for (const rule of Array.from(group.cssRules)) {
            if (isStyleRule(rule)) {
                const original = rule.selectorText;
                const excluded = scopeOut(original);

                if (excluded !== original) {
                    rule.selectorText = excluded;
                    // The setter ignores a selector the engine does not accept.
                    if (rule.selectorText !== original) this.excluded.push({ rule, original });
                }
            }
            if (isRuleGroup(rule)) this.exclude(rule);
        }
    }

    /**
     * Collects the properties that rules on the document root (`:root`, `html`,
     * `body`) set under an emulated condition, into {@link rootProperties}.
     */
    private collectRootProperties(group: RuleGroup, emulated: EmulatedMedia, parent: string | null, emulatedHere: boolean): void {
        for (const rule of Array.from(group.cssRules)) {
            const selector = isStyleRule(rule) ? rule.selectorText : parent;

            if (emulatedHere && hasStyle(rule) && selector !== null && targetsRoot(selector)) {
                for (const name of Array.from(rule.style)) this.rootProperties.add(name);
            }
            if (isRuleGroup(rule)) {
                this.collectRootProperties(rule, emulated, selector, emulatedHere || (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated)));
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
    private copyRootValues(group: RuleGroup, emulated: EmulatedMedia, properties: ReadonlySet<string>): void {
        for (let i = 0; i < group.cssRules.length; i++) {
            const rule = group.cssRules[i];

            if (this.copies.has(rule) || (isMediaRule(rule) && mentionsEmulated(rule.media.mediaText, emulated))) continue;
            if (isStyleRule(rule) && targetsRoot(rule.selectorText)) {
                const style = rule.style;
                const declarations = Array.from(style)
                    .filter((name) => properties.has(name))
                    .map((name) => `${name}: ${style.getPropertyValue(name)}${style.getPropertyPriority(name) ? ' !important' : ''};`)
                    .join(' ');

                if (declarations !== '') {
                    if (isRuleGroup(rule) && rule.cssRules.length > 0) this.insert(rule, 0, `& ${SCOPE_ROOTS} { ${declarations} }`);
                    else if (this.insert(group, i + 1, `${scopeIn(rule.selectorText)} { ${declarations} }`)) i++;
                }
            }
            if (isRuleGroup(rule)) this.copyRootValues(rule, emulated, properties);
        }
    }

    /** Inserts a rule of the engine's own, which {@link restore} removes again. */
    private insert(group: RuleGroup, index: number, text: string): CSSRule | null {
        try {
            group.insertRule(text, index);
        } catch {
            if (isDevMode()) console.warn(`[ng-prism] Could not add a rule for the simulation: ${text.slice(0, text.indexOf('{')).trim()}`);
            return null;
        }
        const rule = group.cssRules[index];

        this.copies.set(rule, group);
        return rule;
    }

    /** Removes the copies and gives every excluded rule its selector back. */
    private restore(): void {
        for (const [rule, group] of this.copies) {
            const index = Array.from(group.cssRules).indexOf(rule);

            if (index >= 0) group.deleteRule(index);
        }

        for (const { rule, original } of this.excluded) {
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

        this.copies.clear();
        this.excluded = [];
        this.sheets.clear();
        this.rootProperties.clear();
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

    private warnOnce(about: object, message: string): void {
        if (this.warned.has(about)) return;
        this.warned.add(about);
        if (isDevMode()) console.warn(`[ng-prism] ${message}`);
    }
}

function sameMedia(a: EmulatedMedia, b: EmulatedMedia): boolean {
    const features = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof EmulatedMedia>;

    return Array.from(features).every((feature) => a[feature] === b[feature]);
}

function unanswerable(media: string, where: string): string {
    return (
        `Cannot simulate "${media}" for ${where}: a condition on a <link>, <style> or @import keeps its real answer. ` +
        'Put it in an @media rule inside the stylesheet instead.'
    );
}

/** A declaration block's text with every declaration `!important`. */
function important(cssText: string): string {
    return declarationsOf(cssText)
        .map((declaration) => (/!\s*important$/i.test(declaration) ? declaration : `${declaration} !important`))
        .join('; ');
}

/**
 * The declarations in a block's text, split at the semicolons outside strings
 * and brackets (`url(a;b)`, a custom property's `{…}`). From the text rather
 * than property by property, since the longhands of a shorthand with a `var()`
 * have no value of their own to set again.
 */
function declarationsOf(cssText: string): string[] {
    const declarations: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < cssText.length; i++) {
        const ch = cssText[i];

        if (ch === '"' || ch === "'") i = stringEnd(cssText, i) - 1;
        else if (ch === '\\') i++;
        else if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ';' && depth === 0) {
            declarations.push(cssText.slice(start, i));
            start = i + 1;
        }
    }
    declarations.push(cssText.slice(start));
    return declarations.map((declaration) => declaration.trim()).filter((declaration) => declaration !== '');
}
