import type { InputMeta, ScannedComponent } from '../../plugin/plugin.types.js';
import { modelChangeOutput, wrapperForwardsModel } from '../../shared/model-outputs.js';

/** The change of a `model()` a wrapper passes on: Angular's output `event` on the subject, emitted again by the wrapper's `member`. */
export interface ForwardedModel {
    member: string;
    event: string;
}

/**
 * The changes of the `model()` inputs among `inputs`, the ones a wrapper binds, which the wrapper passes on so that the
 * styleguide hears them. The scan lists no output for them. An output the subject declares under either name is passed
 * on as an output already.
 */
export function forwardedModels(comp: ScannedComponent, inputs: readonly InputMeta[]): ForwardedModel[] {
    return inputs
        .filter((input) => input.model && wrapperForwardsModel(input, comp.outputs))
        .map((input) => ({ member: modelChangeOutput(input.name), event: modelChangeOutput(input.alias ?? input.name) }));
}
