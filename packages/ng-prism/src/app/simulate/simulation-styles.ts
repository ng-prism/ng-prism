import { collectForcedColorRules, forcedColorsCss } from './forced-colors.js';
import type { ForcedPaletteName } from './forced-palette.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import type { EmulatedMedia } from './simulation.js';

/**
 * The stylesheet half of the simulation: the media engine
 * ({@link MediaStyleSheets}) and the sheet that approximates forced colors,
 * adopted after the engine has rewritten the document's sheets and ignored by it
 * ever since. It needs no Angular, so that a page without the app can load it
 * the way the runtime service does.
 *
 * `matchMedia` and the scope roots are not part of it: the runtime service
 * carries those into the page.
 */
export class SimulationStyles {
    // New styles while forced colors are on can bring exemptions and gradients of their own.
    private readonly media: MediaStyleSheets;
    private forcedSheet: CSSStyleSheet | null = null;
    /** The palette of the last {@link apply}, `null` while forced colors are off. */
    private palette: ForcedPaletteName | null = null;
    /** The palette the adopted sheet was last written in. */
    private written: ForcedPaletteName | null = null;

    constructor(private readonly doc: Document) {
        this.media = new MediaStyleSheets(doc, () => this.refreshForcedSheet());
    }

    /**
     * Emulates `emulated` in the scope and, with a `palette`, adopts the forced
     * colors sheet in it. Both resolve system colors in the palette. Idempotent.
     */
    apply(emulated: EmulatedMedia, palette: ForcedPaletteName | null): void {
        const emulating = Object.keys(emulated).length > 0;

        // Set first: the media engine calls back for the styles it rewrites, and the sheet is to be written in this palette.
        this.palette = palette;
        if (emulating) this.media.apply(emulated, palette);
        else this.media.clear();
        // After the media engine, and ignored by it before it is adopted, so that it is never rewritten.
        this.adoptForcedSheet(palette);
    }

    /** Takes back everything {@link apply} did. */
    clear(): void {
        this.apply({}, null);
    }

    /**
     * Adopts the sheet that approximates forced colors in `palette`, or takes it
     * away for `null`. While it is adopted, {@link refreshForcedSheet} keeps it
     * up to date.
     */
    private adoptForcedSheet(palette: ForcedPaletteName | null): void {
        const doc = this.doc;
        const adopted = this.forcedSheet;

        if (adopted) {
            if (palette === null) {
                this.forcedSheet = null;
                doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((sheet) => sheet !== adopted);
            } else if (this.written !== palette) {
                // Unless the media engine called back for the styles it rewrote, which wrote it in this palette already.
                this.write(adopted, palette);
            }
            return;
        }
        if (palette === null) return;

        // A document that cannot adopt sheets keeps the rest of the simulation.
        const Sheet = doc.defaultView?.CSSStyleSheet;

        if (!doc.adoptedStyleSheets || typeof Sheet?.prototype.replaceSync !== 'function') return;

        const sheet = new Sheet();

        this.write(sheet, palette);
        this.media.ignore(sheet);
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
        this.forcedSheet = sheet;
    }

    /**
     * Rewrites the adopted forced colors sheet in place, with the exemptions
     * and gradients collected again. The media engine calls it when it has
     * rewritten styles it had not seen: a component opened for the first time
     * brings its styles while forced colors are on.
     */
    private refreshForcedSheet(): void {
        const sheet = this.forcedSheet;
        const palette = this.palette;

        // Without a palette, the sheet is about to go.
        if (sheet && palette) this.write(sheet, palette);
    }

    private write(sheet: CSSStyleSheet, palette: ForcedPaletteName): void {
        sheet.replaceSync(forcedColorsCss(collectForcedColorRules(this.doc, [sheet]), palette));
        this.written = palette;
    }
}
