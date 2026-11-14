import type { RuntimeComponent } from '../../plugin/plugin.types.js';
import { modelChangeOutput, wrapperForwardsModel } from '../../shared/model-outputs.js';
import { activeCase } from './composition.js';
import { buildInputBindings } from './input-bindings.js';

/** Where the change of one `model()` input can be heard on the rendered instance, and the name of the event it is. */
export interface ModelChangeSource {
    /** The input, by member name, as `inputValues` holds it. */
    input: string;
    /** The member of the instance to subscribe to: the model signal itself, or the change output of a wrapper. */
    member: string;
    /** The output Angular adds for the model, which the events panel lists it as. */
    event: string;
}

/**
 * The `model()` inputs of variant `variantIndex` whose changes the renderer listens to: those the variant binds. A
 * component it renders itself is subscribed to through its model signal. A directive renders in `__PrismHost` and a
 * composed variant in the composition wrapper, which pass the change on as an output of the member's name plus `Change`,
 * unless an output of the subject takes that name (see `wrapperForwardsModel`).
 */
export function modelChangeSources(comp: RuntimeComponent, variantIndex: number): ModelChangeSource[] {
    const bindings = buildInputBindings(comp, variantIndex);
    const wrapped = comp.meta.componentMeta.isDirective || activeCase(comp, variantIndex) !== null;

    return comp.meta.inputs
        .filter((input) => input.model && bindings.has(input.name) && (!wrapped || wrapperForwardsModel(input, comp.meta.outputs)))
        .map((input) => ({
            input: input.name,
            member: wrapped ? modelChangeOutput(input.name) : input.name,
            event: modelChangeOutput(input.alias ?? input.name)
        }));
}
