import type { InputMeta, RuntimePart } from '../../plugin/plugin.types.js';
import { formatDateValue } from '../../shared/date-value.js';
import { modelChangeOutput } from '../../shared/model-outputs.js';
import { partKeys } from '../../shared/part-keys.js';
import { type StatusBadge, statusBadge } from './status-badge.js';

/** One input or output in the popover of a part. An output has neither type nor default. */
export interface PartRow {
    name: string;
    type?: string;
    defaultValue?: string;
    required?: boolean;
    doc?: string;
}

/** A part of the active component as the head shows it: a chip, and the popover that opens from it. */
export interface PartChip {
    className: string;
    /** What the panel service and the URL address the part by, see `partKeys`. */
    key: string;
    title: string;
    selector: string;
    /**
     * The id of the popover and the `popovertarget` of the chip, by the position of the part rather than its class: two
     * parts from different files can share a class name, and every chip still opens its own card.
     */
    popoverId: string;
    /** The CSS anchor name of the chip, which the card positions itself against; by position, as `popoverId`. */
    anchorName: string;
    status: StatusBadge | null;
    description?: string;
    inputs: PartRow[];
    outputs: PartRow[];
}

/**
 * The default of an input as it is written in a template: a string in single
 * quotes, its quotes and backslashes escaped, a `Date` as its day, anything else
 * as JSON. `undefined` for an input that starts out without one, and `…` for one
 * that has a default the scan could not evaluate.
 */
export function formatPartDefault(input: InputMeta): string | undefined {
    if (input.defaultUnreadable) return '…';
    const value = input.defaultValue;

    if (value === undefined) return undefined;
    if (value instanceof Date) return formatDateValue(value);
    return typeof value === 'string' ? `'${value.replace(/[\\']/g, '\\$&')}'` : JSON.stringify(value);
}

/**
 * The chips of the parts of a component, in the order given: the manifest
 * already sorts them by title. Inputs and outputs go by the name a template
 * binds them with, so an alias wins over the class member. The outputs end
 * with the change output Angular adds for each `model()`, which the scan does
 * not list among them.
 */
export function partChips(parts: readonly RuntimePart[] | undefined): PartChip[] {
    const keys = partKeys((parts ?? []).map(({ meta }) => meta.className));

    return (parts ?? []).map(({ meta }, index) => ({
        className: meta.className,
        key: keys[index],
        title: meta.showcaseConfig.title,
        selector: meta.componentMeta.selector,
        popoverId: `prism-part-${index}`,
        anchorName: `--prism-part-${index}`,
        status: statusBadge(meta.showcaseConfig.status),
        description: meta.showcaseConfig.description,
        inputs: meta.inputs.map((input) => ({
            name: input.alias ?? input.name,
            type: input.rawType ?? input.type,
            defaultValue: formatPartDefault(input),
            required: input.required,
            doc: input.doc
        })),
        outputs: [
            ...meta.outputs.map((output) => ({ name: output.alias ?? output.name, doc: output.doc })),
            ...meta.inputs.filter((input) => input.model).map((input) => modelChangeRow(input.alias ?? input.name))
        ]
    }));
}

/** The row of the change output of the `model()` a template binds as `input`. */
function modelChangeRow(input: string): PartRow {
    return { name: modelChangeOutput(input), doc: `Emits when ${input} changes; bind both ways with [(${input})].` };
}
