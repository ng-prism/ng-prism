import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PrismIconComponent } from '../icons/prism-icon.component.js';

/**
 * Identity disclosure for the component head.
 *
 * Selector, description and tags all answer "what is this component", a
 * question you read once on arrival and never again while building. Keeping
 * them permanently on screen cost a 128px band to say something that belongs
 * behind one glyph.
 *
 * A service has no selector, so its code block shows the class name instead,
 * and `facts` carries the plain lines that stand in for the variant and state
 * counts a service does not have. A pipe has none either; its code block is
 * whatever `code` says, which is how it is written in a template.
 *
 * Opening is click-only, through the native Popover API. Escape, click-outside
 * dismissal and top-layer placement come with it declaratively; a hover panel
 * would mean rebuilding all three by hand, and crossing the gap between icon
 * and card without the card closing is its own problem.
 */
@Component({
    selector: 'prism-head-info',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PrismIconComponent],
    templateUrl: './prism-head-info.component.html',
    styleUrl: './prism-head-info.component.css'
})
export class PrismHeadInfoComponent {
    readonly selector = input<string | undefined>(undefined);
    /** Replaces the code block, which otherwise shows the selector of a component or the class name of a service. */
    readonly code = input<string | undefined>(undefined);
    readonly className = input<string | undefined>(undefined);
    readonly description = input<string | undefined>(undefined);
    readonly tags = input<readonly string[]>([]);
    readonly variantCount = input<number>(0);
    readonly stateCount = input<number>(0);
    readonly facts = input<readonly string[]>([]);
    /** The tone of a dot on the button: set by a compact head when a metric inside the card warns or alarms. */
    readonly dot = input<'warn' | 'danger' | null>(null);
    /** What the dot stands for, for the button's accessible name: which metric, and under what it was measured when that is a simulation. */
    readonly dotReason = input<string | null>(null);

    protected readonly label = computed(() => {
        if (this.selector() !== undefined) return 'Component details';
        return this.code() === undefined ? 'Service details' : 'Pipe details';
    });

    protected readonly buttonLabel = computed(() => (this.dot() ? `${this.label()}, ${this.dotReason() ?? 'a metric needs attention'}` : this.label()));

    protected readonly codeBlock = computed(() => {
        const code = this.code();

        if (code !== undefined) return code;
        const selector = this.selector();

        return selector ? `<${selector}>` : (this.className() ?? '');
    });
}
