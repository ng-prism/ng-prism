import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, Injector, untracked } from '@angular/core';
import { PrismSimulationService } from '../services/prism-simulation.service.js';
import { collectForcedColorRules, forcedColorsCss } from './forced-colors.js';
import { type MatchMediaPatch, patchMatchMedia } from './match-media-patch.js';
import { MediaStyleSheets } from './media-stylesheets.js';
import { applyScopeRoot, type ScopeRootState } from './scope-root.js';
import { OVERLAY_ROOT } from './scope-selector.js';
import type { EmulatedMedia } from './simulation.js';

/**
 * Carries the simulation from {@link PrismSimulationService} into the page:
 * the stylesheets ({@link MediaStyleSheets}), `matchMedia`
 * ({@link patchMatchMedia}), the forced colors sheet and the CDK overlay
 * container as a scope root. The scope roots in the canvas and the Overview
 * belong to the components that render them.
 *
 * Every part runs only while it has something to do and takes back what it
 * changed when it stops and when the app is destroyed. The shell starts it
 * once, after the URL and the session have restored the simulation.
 */
@Injectable({ providedIn: 'root' })
export class PrismSimulationRuntime {
    private readonly sim = inject(PrismSimulationService);
    private readonly doc = inject(DOCUMENT);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);
    // New styles while forced colors are on can bring exemptions and gradients of their own.
    private readonly stylesheets = new MediaStyleSheets(this.doc, () => this.refreshForcedSheet());

    private started = false;
    private matchMediaPatch: MatchMediaPatch | null = null;
    private forcedSheet: CSSStyleSheet | null = null;
    private bodyObserver: MutationObserver | null = null;
    /** The overlay containers made scope roots. */
    private overlays: HTMLElement[] = [];

    /** Starts carrying the simulation into the page. Idempotent. */
    init(): void {
        if (this.started) return;
        this.started = true;

        // The signals are read outside `untracked`, the page is changed inside: a `change`
        // listener that the `matchMedia` patch calls synchronously must not add to the effect.
        effect(
            () => {
                const emulated = this.sim.emulated();
                const forced = this.sim.forcedActive();

                untracked(() => this.emulate(emulated, forced));
            },
            { injector: this.injector }
        );
        effect(
            () => {
                const root = this.sim.scopeRoot();

                untracked(() => this.scopeOverlays(root));
            },
            { injector: this.injector }
        );

        this.destroyRef.onDestroy(() => {
            this.emulate({}, false);
            this.scopeOverlays(null);
        });
    }

    private emulate(emulated: EmulatedMedia, forced: boolean): void {
        const emulating = Object.keys(emulated).length > 0;

        if (emulating) this.stylesheets.apply(emulated);
        else this.stylesheets.clear();
        this.patchMatchMedia(emulating ? emulated : null);
        // After the stylesheets, and ignored by them before it is adopted, so that it is never rewritten.
        this.adoptForcedSheet(forced);
    }

    private patchMatchMedia(emulated: EmulatedMedia | null): void {
        const win = this.doc.defaultView;

        if (!emulated) {
            this.matchMediaPatch?.uninstall();
            this.matchMediaPatch = null;
        } else if (this.matchMediaPatch) {
            this.matchMediaPatch.update(emulated);
        } else if (win && typeof win.matchMedia === 'function') {
            this.matchMediaPatch = patchMatchMedia(win, emulated);
        }
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
        this.stylesheets.ignore(sheet);
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

    /**
     * Makes the CDK overlay containers at the body scope roots with `root`, and
     * watches the body for one that comes later, as long as `root` is not `null`.
     * CDK appends its container to the body when the first overlay opens.
     */
    private scopeOverlays(root: ScopeRootState | null): void {
        const body = this.doc.body;

        if (!root || !body) {
            this.bodyObserver?.disconnect();
            this.bodyObserver = null;

            const overlays = this.overlays;

            this.overlays = [];
            for (const overlay of overlays) applyScopeRoot(overlay, null);
            return;
        }

        if (!this.bodyObserver && typeof MutationObserver !== 'undefined') {
            this.bodyObserver = new MutationObserver(() => {
                const current = this.sim.scopeRoot();

                if (current) this.findOverlays(body, current);
            });
            this.bodyObserver.observe(body, { childList: true });
        }
        this.findOverlays(body, root);
    }

    private findOverlays(body: HTMLElement, root: ScopeRootState): void {
        const found = Array.from(body.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(OVERLAY_ROOT));
        const gone = this.overlays.filter((overlay) => !found.includes(overlay));

        // Recorded before anything is applied, so that a release reaches every container even after an apply threw.
        this.overlays = found;
        for (const overlay of gone) applyScopeRoot(overlay, null);
        for (const overlay of found) applyScopeRoot(overlay, root);
    }
}
