import type { InputMeta, OutputMeta } from '../plugin/plugin.types.js';

/** The output Angular adds for a `model()` input a template binds as `input`, which `[(input)]` listens to. Since 22.7.0. */
export function modelChangeOutput(input: string): string {
    return `${input}Change`;
}

/**
 * The outputs a template binds on a component or directive, by alias or name: its outputs, then the change output
 * Angular adds for each `model()` input, which the scan does not list among the outputs. Since 22.7.0.
 */
export function publicOutputNames({ inputs, outputs }: { inputs: readonly InputMeta[]; outputs: readonly OutputMeta[] }): string[] {
    return [
        ...outputs.map((output) => output.alias ?? output.name),
        ...inputs.filter((input) => input.model).map((input) => modelChangeOutput(input.alias ?? input.name))
    ];
}

/**
 * Whether a wrapper passes on the change of `model()` input `input` as an output of its own, `<name>Change`. Not where
 * an output of the subject already has that member name or the public name of the change: the wrapper passes that output
 * on instead. Since 22.8.0.
 */
export function wrapperForwardsModel(input: InputMeta, outputs: readonly OutputMeta[]): boolean {
    const member = modelChangeOutput(input.name);
    const event = modelChangeOutput(input.alias ?? input.name);

    return !outputs.some((output) => output.name === member || (output.alias ?? output.name) === event);
}
