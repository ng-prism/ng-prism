import { isDevMode } from '@angular/core';
import { collectForcedColorRules, collectForcedColorRulesIn, FORCED_LAYER, type ForcedColorRules, forcedColorsCss, mergeForcedColorRules } from './forced-colors.js';
import type { ForcedPaletteName } from './forced-palette.js';
import { type ForcedOptions, MediaStyleSheets } from './media-stylesheets.js';
import { type EmulatedMedia, sameMedia } from './simulation.js';

/** The statement that declares the layer of the forced colors sheet, before any layer of the author's. */
const LAYER_STATEMENT = `@layer ${FORCED_LAYER};`;

/** What the adopted sheet was last written for. */
interface Written {
    readonly palette: ForcedPaletteName;
    readonly rules: ForcedColorRules;
    readonly layered: boolean;
}

/**
 * The stylesheet half of the simulation: the media engine
 * ({@link MediaStyleSheets}), which puts the twins of the author's rules into the
 * document's sheets while forced colors are on, and the sheet that sets their
 * context ({@link forcedColorsCss}), adopted after the engine has rewritten the
 * document's sheets and ignored by it ever since. It needs no Angular app or
 * injection context, so that a page without the app can load it the way the
 * runtime service does.
 *
 * The forced colors sheet sits in the cascade layer {@link FORCED_LAYER}, which
 * a statement at the start of the first readable sheet of the document declares
 * before any layer of the author's: the lowest layer of all, which loses against
 * every rule of the author's and every twin.
 *
 * `matchMedia` and the scope roots are not part of it: the runtime service
 * carries those into the page.
 */
export class SimulationStyles {
    private readonly media: MediaStyleSheets;
    private forcedSheet: CSSStyleSheet | null = null;
    private emulated: EmulatedMedia = {};
    /** The palette of the last {@link apply}, `null` while forced colors are off. */
    private palette: ForcedPaletteName | null = null;
    /** What the media engine was last given for forced colors. */
    private forced: ForcedOptions | null = null;
    private written: Written | null = null;
    /** The statement that declares the layer, and the sheet it was inserted into. */
    private layerStatement: { readonly sheet: CSSStyleSheet; readonly rule: CSSRule } | null = null;
    /** Whether the document refused the statement, which leaves the forced colors sheet without its layer. */
    private layerRefused = false;
    /** While the media engine applies for this object, the styles it calls back for are known already. */
    private applying = false;

    constructor(private readonly doc: Document) {
        this.media = new MediaStyleSheets(doc, (sheets) => this.onNewStyles(sheets));
    }

    /**
     * Emulates `emulated` in the scope and, with a `palette`, forces colors in
     * it: the twins of the author's rules and the forced colors sheet, both in
     * the palette. The exemptions and the custom properties of gradients are
     * collected anew, unless nothing changed. Idempotent.
     */
    apply(emulated: EmulatedMedia, palette: ForcedPaletteName | null): void {
        const same = sameMedia(this.emulated, emulated) && this.palette === palette;

        this.emulated = { ...emulated };
        this.palette = palette;
        if (palette === null) this.forced = null;
        else if (!same || this.forced === null) this.forced = { palette, rules: collectForcedColorRules(this.doc, this.ownSheets()) };
        this.applyMedia();
        // After the media engine, and ignored by it before it is adopted, so that it is never rewritten.
        this.adoptForcedSheet();
    }

    /** Takes back everything {@link apply} did. */
    clear(): void {
        this.apply({}, null);
    }

    private applyMedia(): void {
        this.applying = true;
        try {
            if (Object.keys(this.emulated).length > 0) this.media.apply(this.emulated, this.forced);
            else this.media.clear();
        } finally {
            this.applying = false;
        }
    }

    /**
     * Styles that arrive while forced colors are on can bring exemptions or
     * custom properties of gradients of their own. Then the twins of every rule
     * are built anew, with what the new styles add: what styles that left had
     * brought stays until forced colors are applied again.
     */
    private onNewStyles(sheets: readonly CSSStyleSheet[]): void {
        const forced = this.forced;

        if (this.applying || forced === null) return;

        const rules = mergeForcedColorRules(forced.rules, collectForcedColorRulesIn(sheets, this.ownSheets()));

        if (rules !== forced.rules) {
            this.forced = { palette: forced.palette, rules };
            // The engine has finished its pass and builds everything anew.
            this.applyMedia();
        }
        this.adoptForcedSheet();
    }

    private ownSheets(): CSSStyleSheet[] {
        return this.forcedSheet ? [this.forcedSheet] : [];
    }

    /**
     * Adopts the forced colors sheet, or takes it away while forced colors are
     * off, and keeps it and the statement of its layer up to date.
     */
    private adoptForcedSheet(): void {
        const doc = this.doc;
        const forced = this.forced;
        const adopted = this.forcedSheet;

        if (forced === null) {
            this.removeLayerStatement();
            if (!adopted) return;
            this.forcedSheet = null;
            this.written = null;
            doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((sheet) => sheet !== adopted);
            return;
        }

        const layered = this.declareLayer();

        if (adopted) {
            this.write(adopted, forced, layered);
            return;
        }

        // A document that cannot adopt sheets keeps the rest of the simulation.
        const Sheet = doc.defaultView?.CSSStyleSheet;

        if (!doc.adoptedStyleSheets || typeof Sheet?.prototype.replaceSync !== 'function') return;

        const sheet = new Sheet();

        this.write(sheet, forced, layered);
        this.media.ignore(sheet);
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
        this.forcedSheet = sheet;
    }

    /** Writes the sheet, unless it says this already. */
    private write(sheet: CSSStyleSheet, { palette, rules }: ForcedOptions, layered: boolean): void {
        const written = this.written;

        if (written && written.palette === palette && written.rules === rules && written.layered === layered) return;
        sheet.replaceSync(forcedColorsCss(rules, palette, layered));
        this.written = { palette, rules, layered };
    }

    /**
     * Keeps the statement of the layer first in the first readable sheet of the
     * document, which a new style can replace or come before. Says whether the
     * forced colors sheet may use the layer: not where the document refused the
     * statement, which would make it the highest layer of all. Without a
     * readable sheet there is no layer of the author's to come before.
     */
    private declareLayer(): boolean {
        if (this.layerRefused) return false;

        const first = this.firstReadableSheet();

        if (!first || (first === this.layerStatement?.sheet && first.cssRules[0] === this.layerStatement.rule)) return true;
        this.removeLayerStatement();
        try {
            first.insertRule(LAYER_STATEMENT, 0);
            this.layerStatement = { sheet: first, rule: first.cssRules[0] };
            return true;
        } catch {
            this.layerRefused = true;
            if (isDevMode()) console.warn(`[ng-prism] Could not declare the layer ${FORCED_LAYER}: the forced colors simulation may win against your layered rules.`);
            return false;
        }
    }

    private removeLayerStatement(): void {
        const statement = this.layerStatement;

        this.layerStatement = null;
        if (!statement) return;

        // Gone already where the sheet was replaced, a `<style>` whose text changed.
        const index = Array.from(statement.sheet.cssRules).indexOf(statement.rule);

        if (index >= 0) statement.sheet.deleteRule(index);
    }

    private firstReadableSheet(): CSSStyleSheet | null {
        for (const sheet of Array.from(this.doc.styleSheets)) {
            if (sheet === this.forcedSheet) continue;
            try {
                if (sheet.cssRules) return sheet;
            } catch {
                // Cross-origin: its layers, if any, come before ours.
            }
        }
        return null;
    }
}
