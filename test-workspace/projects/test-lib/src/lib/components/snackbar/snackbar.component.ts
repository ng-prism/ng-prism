import { createGlobalPositionStrategy, createNoopScrollStrategy, createOverlayRef, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    Injector,
    input,
    model,
    signal,
    type TemplateRef,
    untracked,
    viewChild,
    ViewContainerRef,
    ViewEncapsulation
} from '@angular/core';
import { Showcase } from '@ng-prism/core';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Short confirmation at the bottom of the viewport, above everything else on the page.
 *
 * The snackbar renders through `@angular/cdk/overlay`: it sits in the overlay container at the end of `body`, not
 * where `<sg-snackbar>` is placed. The element itself is the button that opens and closes it.
 *
 * When it opens, it asks `matchMedia('(prefers-reduced-motion: reduce)')`. It slides in unless that matches, and it
 * shows the answer in its second line. A change of the preference while it is open updates that line.
 *
 * In forced colors mode, which drops its fill and its shadow, a border in `CanvasText` keeps its edge.
 *
 * @since 1.10.0
 * @example
 * ```html
 * <sg-snackbar message="Draft saved" [(open)]="saved" />
 * ```
 */
@Showcase({
    title: 'Snackbar',
    status: 'beta',
    category: 'Overlay',
    description: 'Confirmation in a CDK overlay at the bottom of the viewport. It asks `matchMedia` whether the user prefers reduced motion and only slides in when not.',
    variants: [
        { name: 'Open', inputs: { open: true, message: 'Draft saved' } },
        { name: 'Closed', inputs: { open: false, message: 'Draft saved' } }
    ],
    tags: ['overlay', 'snackbar', 'toast', 'feedback', 'motion']
})
@Component({
    selector: 'sg-snackbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        class: 'sg-snackbar-host'
    },
    template: `
        <button type="button" class="sg-snackbar-trigger" [attr.aria-expanded]="open()" (click)="open.set(!open())">
            {{ open() ? 'Hide snackbar' : 'Show snackbar' }}
        </button>
        <ng-template #panel>
            <div class="sg-snackbar" role="status" [class.sg-snackbar--slide]="!reducedMotion()" [attr.data-reduced-motion]="reducedMotion()">
                <span class="sg-snackbar__mark" aria-hidden="true"></span>
                <span class="sg-snackbar__text">
                    <span class="sg-snackbar__message">{{ message() }}</span>
                    <span class="sg-snackbar__motion">prefers-reduced-motion: {{ reducedMotion() ? 'reduce' : 'no-preference' }}</span>
                </span>
            </div>
        </ng-template>
    `,
    styles: `
        .sg-snackbar-trigger {
            padding: 8px 14px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #fff;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.2;
            color: #111827;
            cursor: pointer;
        }
        .sg-snackbar {
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 12px 16px;
            border-radius: 10px;
            background: #1f2937;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #f9fafb;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        }
        .sg-snackbar--slide {
            animation: sg-snackbar-in 0.3s ease-out;
        }
        .sg-snackbar__mark {
            flex: none;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #22c55e;
        }
        .sg-snackbar__text {
            display: flex;
            flex-direction: column;
        }
        .sg-snackbar__message {
            font-weight: 600;
        }
        .sg-snackbar__motion {
            font-family: ui-monospace, monospace;
            font-size: 12px;
            color: #9ca3af;
        }
        @keyframes sg-snackbar-in {
            from {
                opacity: 0;
                transform: translateY(16px);
            }
        }
        @media (forced-colors: active) {
            .sg-snackbar {
                border: 1px solid CanvasText;
            }
        }
    `
})
export class SnackbarComponent {
    /** Whether the snackbar is shown. Two-way bindable with `[(open)]`; the trigger button flips it. */
    readonly open = model<boolean>(false);

    /** Text of the snackbar. */
    readonly message = input<string>('');

    /** What `matchMedia` answered for reduced motion when the snackbar opened, or since. */
    protected readonly reducedMotion = signal(false);

    private readonly panel = viewChild<TemplateRef<unknown>>('panel');
    private readonly injector = inject(Injector);
    private readonly viewContainerRef = inject(ViewContainerRef);
    private readonly window = inject(DOCUMENT).defaultView;
    private overlayRef: OverlayRef | null = null;
    private stopListening: (() => void) | null = null;

    constructor() {
        effect(() => {
            const panel = this.panel();

            if (panel && this.open()) untracked(() => this.attach(panel));
            else untracked(() => this.detach());
        });
        inject(DestroyRef).onDestroy(() => this.detach());
    }

    private attach(panel: TemplateRef<unknown>): void {
        if (this.overlayRef) return;

        // Asked on every opening: a list held from earlier would not see what changed in between.
        const query = this.window?.matchMedia?.(REDUCED_MOTION) ?? null;

        if (query) {
            const onChange = (event: MediaQueryListEvent): void => this.reducedMotion.set(event.matches);

            query.addEventListener('change', onChange);
            this.stopListening = () => query.removeEventListener('change', onChange);
        }
        this.reducedMotion.set(query?.matches ?? false);

        this.overlayRef = createOverlayRef(this.injector, {
            positionStrategy: createGlobalPositionStrategy(this.injector).bottom('24px').centerHorizontally(),
            scrollStrategy: createNoopScrollStrategy(),
            panelClass: 'sg-snackbar-pane'
        });
        this.overlayRef.attach(new TemplatePortal(panel, this.viewContainerRef));
    }

    private detach(): void {
        this.stopListening?.();
        this.stopListening = null;
        this.overlayRef?.dispose();
        this.overlayRef = null;
    }
}
