import { useScene } from '@revideo/core';
import { decodeVariables, VARIABLES_KEY } from '../lib/variables.ts';

/** The variables scripts/render.ts gave this cut (see lib/variables.ts for why they travel encoded). */
export function cutVariables<T>(): T {
    return decodeVariables<T>(useScene().variables.get(VARIABLES_KEY, '')());
}
