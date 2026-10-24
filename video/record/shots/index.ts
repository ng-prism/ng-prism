import { composition } from './composition.ts';
import { controls } from './controls.ts';
import { look } from './look.ts';
import { quality } from './quality.ts';
import { reveal } from './reveal.ts';
import { servicePage } from './service-page.ts';
import type { Shot } from './shot.ts';
import { states } from './states.ts';

export const SHOTS: readonly Shot[] = [reveal, controls, quality, states, look, servicePage, composition];

export function shotById(id: string): Shot {
    const shot = SHOTS.find((candidate) => candidate.id === id);
    if (!shot) throw new Error(`Unknown shot "${id}"`);
    return shot;
}
