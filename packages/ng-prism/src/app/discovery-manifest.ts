import type { DiscoveryComponent, DiscoveryManifest, DiscoveryPart, DiscoveryState, DiscoveryVariant, RuntimeManifest } from '../plugin/plugin.types.js';
import type { CanvasBg } from '../shared/canvas-bg.type.js';
import { publicOutputNames } from '../shared/model-outputs.js';
import type { ForcedPseudoStates } from '../shared/pseudo-state.type.js';
import { resolveVariantBg } from '../shared/variant-bg.js';
import { forcesAnyState } from './pseudo/pseudo-targets.js';

/**
 * External tooling reads `__PRISM_MANIFEST__` through a structured-clone bridge
 * (Playwright's `page.evaluate()`, `postMessage`, devtools). `ShowcaseConfig.meta`
 * is an open `Record<string, unknown>`, and a class, function or cyclic object
 * in it makes that bridge throw or drop the whole payload.
 *
 * So only JSON-safe values cross: primitives, arrays and plain-prototype
 * objects. Class instances, functions, symbols, Dates, Maps and DOM nodes are
 * dropped and cycles are broken. Unrepresentable array elements become `null`,
 * as in `JSON.stringify`, so indices stay stable.
 */
function toSerializable(value: unknown, seen: Set<object>): unknown {
    if (value === null) return null;

    const type = typeof value;

    if (type === 'string' || type === 'boolean') return value;
    if (type === 'number') return Number.isFinite(value) ? value : undefined;
    if (type !== 'object') return undefined;

    const object = value as object;

    if (seen.has(object)) return undefined;

    if (Array.isArray(object)) {
        seen.add(object);
        const items = object.map((item) => {
            const serialized = toSerializable(item, seen);

            return serialized === undefined ? null : serialized;
        });

        seen.delete(object);
        return items;
    }

    const proto = Object.getPrototypeOf(object) as object | null;

    if (proto !== Object.prototype && proto !== null) return undefined;

    seen.add(object);
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(object)) {
        const serialized = toSerializable(item, seen);

        if (serialized !== undefined) result[key] = serialized;
    }
    seen.delete(object);
    return result;
}

/** Sanitised `meta`, or `undefined` when there is nothing worth exposing. */
export function serializableMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const serialized = toSerializable(meta, new Set()) as Record<string, unknown> | undefined;

    if (!serialized || Object.keys(serialized).length === 0) return undefined;
    return serialized;
}

/**
 * Builds the discovery view of the manifest, i.e. what `__PRISM_MANIFEST__` exposes.
 *
 * It is not the runtime manifest: no Angular class references, no
 * providers, no scanned input/output metadata. It carries what an external tool
 * needs to enumerate and address variants and component-level states, plus the
 * `@Showcase` metadata that lets a tool decide how to treat one.
 *
 * A part (`@Showcase({ partOf })`) is listed under its parent as `parts`, with the
 * public names of its inputs and outputs, and never in `components`.
 *
 * `fallback` is the project's `showcaseDefaults.bg`: the `bg` of a variant that
 * declares none, in place of `DEFAULT_VARIANT_BG`.
 */
export function buildDiscoveryManifest(manifest: RuntimeManifest, fallback: CanvasBg | null = null): DiscoveryManifest {
    return {
        components: manifest.components.map((component): DiscoveryComponent => {
            const { className, showcaseConfig } = component.meta;

            // An empty `variants` array is not "no variants": the renderer still
            // instantiates the component with its declared defaults at index 0 and
            // marks it `data-prism-rendered="<class>:0"`. Reporting zero variants
            // here would let a runner walk past a component the app happily renders.
            // That's the quiet coverage loss the `excluded` status exists to prevent.
            const declared = showcaseConfig.variants ?? [];
            const variants: DiscoveryVariant[] = declared.length
                ? declared.map((variant, index) => {
                      const meta = serializableMeta(variant.meta);
                      const pseudo = forcesAnyState(variant.pseudo) ? (serializableMeta(variant.pseudo) as ForcedPseudoStates | undefined) : undefined;
                      const discovered: DiscoveryVariant = { name: variant.name, index, bg: resolveVariantBg(showcaseConfig, index, fallback) };

                      if (meta) discovered.meta = meta;
                      if (pseudo) discovered.pseudo = pseudo;
                      if (variant.states === false) discovered.states = false;
                      return discovered;
                  })
                : [
                      {
                          name: 'Default',
                          index: 0,
                          bg: resolveVariantBg(showcaseConfig, 0, fallback)
                      }
                  ];

            // Every slot is listed, the empty ones too: the scanner keeps a state it
            // cannot use as `{ name, pseudo: {} }` so the position in the array stays
            // the `?state=` value of the states behind it.
            const states: DiscoveryState[] = (showcaseConfig.states ?? []).map((state, index) => ({
                name: state.name,
                index,
                pseudo: (serializableMeta(state.pseudo) ?? {}) as ForcedPseudoStates
            }));

            const meta = serializableMeta(showcaseConfig.meta);
            const discovered: DiscoveryComponent = {
                className,
                title: showcaseConfig.title,
                variants
            };

            const parts: DiscoveryPart[] = (component.parts ?? []).map(({ meta: part }) => ({
                className: part.className,
                title: part.showcaseConfig.title,
                selector: part.componentMeta.selector,
                inputs: part.inputs.map((input) => input.alias ?? input.name),
                outputs: publicOutputNames(part)
            }));

            if (states.length) discovered.states = states;
            if (meta) discovered.meta = meta;
            if (parts.length) discovered.parts = parts;
            return discovered;
        }),
        pages: (manifest.pages ?? []).map((page) => ({ title: page.title }))
    };
}
