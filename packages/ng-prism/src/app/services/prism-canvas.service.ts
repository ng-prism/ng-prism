import { inject, Injectable, signal } from '@angular/core';
import { CANVAS_BGS, type CanvasBg } from '../../shared/canvas-bg.type.js';
import { clampViewportWidth, VIEWPORT_DEFAULT } from '../../shared/viewport.type.js';
import { PrismCaptureService } from './prism-capture.service.js';

export type { CanvasBg };

const STORAGE_KEY = 'ng-prism-canvas';

@Injectable({ providedIn: 'root' })
export class PrismCanvasService {
    readonly bg = signal<CanvasBg>('dots');

    private readonly _bgChosen = signal(false);

    /**
     * Whether the user picked the canvas background, as opposed to it being the
     * default `dots`.
     *
     * The value alone cannot tell them apart, and the difference matters once
     * an emulated color scheme moves the ground: a default ground follows it, a
     * picked one stays, `dots` included.
     */
    readonly bgChosen = this._bgChosen.asReadonly();
    readonly zoom = signal(1);
    readonly guides = signal(false);
    readonly rulers = signal(false);

    /**
     * Whether the measuring tool is active.
     *
     * Lives here rather than in `PrismMeasureService` because it is the same
     * kind of state as `guides` and `rulers`: a preference about the working
     * environment, not a statement about this variant. That also means the
     * toggle inherits the constructor's capture-mode behaviour below for
     * free, without having to repeat it.
     */
    readonly measure = signal(false);

    /**
     * The width `.demo-wrap` is constrained to, or `null` for "as wide as it
     * wants".
     *
     * Nullable rather than a `0`/`-1` sentinel because "off" is a
     * different state and not a width: the renderer keys a whole set of CSS off
     * `[data-viewport]`, and a falsy number would make `viewportWidth() ? ... `
     * silently treat a legal narrow width as "off" the moment the floor ever
     * moved to 0.
     */
    readonly viewportWidth = signal<number | null>(null);

    private readonly capture = inject(PrismCaptureService);

    /**
     * What `toggleViewport()` restores.
     *
     * Kept in a field rather than persisted: it exists so that flicking the rail
     * button off and on again does not throw away a width you just dragged to,
     * which is a within-session concern. The width that *is* worth carrying
     * across sessions is the live one, and that is already in `viewportWidth`.
     */
    private lastViewportWidth = VIEWPORT_DEFAULT;

    constructor() {
        // Capture mode renders for a screenshot tool: persisted zoom, guides,
        // rulers and the measure toggle would leak a previous session's state
        // into the image, so the defaults (zoom 1, no guides, no rulers, measure
        // off) are kept and nothing is written back.
        if (this.capture.active()) return;
        this.loadFromStorage();
    }

    setBg(bg: CanvasBg): void {
        this.bg.set(bg);
        this._bgChosen.set(true);
        this.save();
    }

    setZoom(z: number): void {
        this.zoom.set(z);
        this.save();
    }

    toggleGuides(): void {
        this.guides.update((v) => !v);
        this.save();
    }

    toggleRulers(): void {
        this.rulers.update((v) => !v);
        this.save();
    }

    toggleMeasure(): void {
        this.measure.update((v) => !v);
        this.save();
    }

    setViewportWidth(w: number | null): void {
        if (w === null) {
            this.viewportWidth.set(null);
        } else {
            const clamped = clampViewportWidth(w);

            this.lastViewportWidth = clamped;
            this.viewportWidth.set(clamped);
        }
        this.save();
    }

    toggleViewport(): void {
        this.setViewportWidth(this.viewportWidth() === null ? this.lastViewportWidth : null);
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) return;
            const d = JSON.parse(raw) as Record<string, unknown>;

            const known = CANVAS_BGS.includes(d['bg'] as CanvasBg);

            if (known) {
                this.bg.set(d['bg'] as CanvasBg);
            }
            // A stored background that no longer exists (a removed value) falls
            // back to the default, and the pick goes with it: nobody chose the
            // default, so it must not outrank a declared background or the
            // emulated scheme.
            const stale = d['bg'] !== undefined && !known;

            // Storage from before the flag existed has none: any background but
            // the default can only have been picked.
            this._bgChosen.set(!stale && (typeof d['bgChosen'] === 'boolean' ? d['bgChosen'] : this.bg() !== 'dots'));
            if (typeof d['zoom'] === 'number') this.zoom.set(d['zoom']);
            if (typeof d['guides'] === 'boolean') this.guides.set(d['guides']);
            if (typeof d['rulers'] === 'boolean') this.rulers.set(d['rulers']);
            if (typeof d['measure'] === 'boolean') this.measure.set(d['measure']);
            if (typeof d['viewportWidth'] === 'number') {
                const w = clampViewportWidth(d['viewportWidth']);

                this.lastViewportWidth = w;
                this.viewportWidth.set(w);
            }
        } catch {
            // Malformed JSON or no storage access: keep the field defaults.
        }
    }

    private save(): void {
        if (this.capture.active()) return;
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    bg: this.bg(),
                    bgChosen: this._bgChosen(),
                    zoom: this.zoom(),
                    guides: this.guides(),
                    rulers: this.rulers(),
                    measure: this.measure(),
                    viewportWidth: this.viewportWidth()
                })
            );
        } catch {
            // Storage may be full or disabled (e.g. private browsing); the
            // canvas state just stays unpersisted for this session.
        }
    }
}
