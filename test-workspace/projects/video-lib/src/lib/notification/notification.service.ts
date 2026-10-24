import { Injectable, signal } from '@angular/core';
import { Showcase } from '@ng-prism/core';

/**
 * Shows short messages at the edge of the viewport, newest first.
 *
 * @example
 * ```ts
 * inject(NotificationService).show('Saved');
 * ```
 */
@Showcase({ title: 'Notification Service', category: 'Feedback' })
@Injectable({ providedIn: 'root' })
export class NotificationService {
    readonly messages = signal<readonly string[]>([]);

    /** Shows `message` on top of the others until `dismiss()` removes it. */
    show(message: string): void {
        this.messages.update((list) => [message, ...list]);
    }

    /** Removes every message. */
    dismiss(): void {
        this.messages.set([]);
    }
}
