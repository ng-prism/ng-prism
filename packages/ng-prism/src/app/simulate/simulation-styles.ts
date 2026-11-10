import { collectForcedColorRules, forcedColorsCss } from './forced-colors.js';
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

    constructor(private readonly doc: Document) {
        this.media = new MediaStyleSheets(doc, () => this.refreshForcedSheet());
    }

    /** Emulates `emulated` in the scope and, with `forced`, adopts the forced colors sheet. Idempotent. */
    apply(emulated: EmulatedMedia, forced: boolean): void {
        const emulating = Object.keys(emulated).length > 0;

        if (emulating) this.media.apply(emulated);
        else this.media.clear();
        // After the media engine, and ignored by it before it is adopted, so that it is never rewritten.
        this.adoptForcedSheet(forced);
    }

    /** Takes back everything {@link apply} did. */
    clear(): void {
        this.apply({}, false);
    }

    /**
     * Adopts the sheet that approximates forced colors, or takes it away. While
     * it is adopted, {@link refreshForcedSheet} keeps it up to date.
     */
    private adoptForcedSheet(forced: boolean): void {
        const doc = this.doc;
        const adopted = this.forcedSheet;

        if (forced === (adopted !== null)) return;

        if (adopted) {
            this.forcedSheet = null;
            doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((sheet) => sheet !== adopted);
            return;
        }

        // A document that cannot adopt sheets keeps the rest of the simulation.
        const Sheet = doc.defaultView?.CSSStyleSheet;

        if (!doc.adoptedStyleSheets || typeof Sheet?.prototype.replaceSync !== 'function') return;

        const sheet = new Sheet();

        sheet.replaceSync(this.forcedColorsText(sheet));
        this.media.ignore(sheet);
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
        this.forcedSheet = sheet;
    }

    /**
     * Collects the exemptions and gradients again and rewrites the adopted
     * forced colors sheet in place. The media engine calls it when it has
     * rewritten styles it had not seen: a component opened for the first time
     * brings its styles while forced colors are on.
     */
    private refreshForcedSheet(): void {
        const sheet = this.forcedSheet;

        sheet?.replaceSync(this.forcedColorsText(sheet));
    }

    private forcedColorsText(own: CSSStyleSheet): string {
        return forcedColorsCss(collectForcedColorRules(this.doc, [own]));
    }
}
