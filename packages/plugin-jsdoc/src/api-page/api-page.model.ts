import {
    type ApiDocTags,
    type ApiMethod,
    type ApiProperty,
    type ApiSetupEntry,
    type ApiTypeDoc,
    type ApiTypeRef,
    formatDefaultValue,
    partKeys,
    type ScannedComponent,
    type ScannedPipe,
    type ScannedService
} from '@ng-prism/core/plugin';
import type { JsDocData, MethodDoc } from '../jsdoc.types.js';
import { partScope } from './api-page.helpers.js';
import { generateComponentUsage } from './component-usage.js';
import { generatePipeUsage } from './pipe-usage.js';
import { generateServiceUsage } from './service-usage.js';

/** A chip under the description, `Since: 1.2.0` or a bare `Pure`; the deprecation is a badge of its own. */
export interface ApiPageChip {
    label: string;
    value?: string;
    deprecated?: true;
}

/** What an API page documents. */
export type ApiPageKind = 'component' | 'directive' | 'service' | 'pipe';

/** An input of a component or directive, by the name a template binds it by. */
export interface ApiInputRow {
    name: string;
    type: ApiTypeRef;
    /** As the code writes it: a string in quotes. */
    defaultValue?: string;
    required: boolean;
    description?: string;
    tags: ApiDocTags;
}

/** An output of a component or directive: an `output()`, or the change event of a `model()`. */
export interface ApiOutputRow {
    name: string;
    /** What the event emits. Absent when the scanner did not read it. */
    payload?: ApiTypeRef;
    description?: string;
    tags: ApiDocTags;
}

/**
 * What the API page shows, for a component, a directive, a service or a pipe.
 * The page renders this alone, so all four kinds share one look; the sections
 * a kind does not have are left out.
 *
 * The entries of `properties`, `methods`, `transform` and `types` are the
 * scanned objects themselves, not copies: the page caches what it derives from
 * them by object. The rows of `inputs` and `outputs`, and the `methods` of a
 * component without `api`, are built anew by every call.
 */
export interface ApiPageModel {
    kind: ApiPageKind;
    className: string;
    description?: string;
    chips: ApiPageChip[];
    see: string[];
    usage: string;
    setup: ApiSetupEntry[];
    examples: string[];
    /** Components and directives only. */
    inputs?: ApiInputRow[];
    /** Components and directives only. */
    outputs?: ApiOutputRow[];
    /** Services only. */
    properties?: ApiProperty[];
    /** Services, components and directives: the public methods. */
    methods?: ApiMethod[];
    /** Pipes: one entry per transform signature. */
    transform?: ApiMethod[];
    types: ApiTypeDoc[];
}

/**
 * A part of a component as its parent's API tab shows it: the heading of its
 * block and its API page. `scope` prefixes every anchor of the block, so the
 * ids of two blocks never meet in the one scroll host.
 */
export interface ApiPagePart {
    className: string;
    /** What `activePart` names the part by: its class name, with `~2` for the second of a class name two parts share. */
    key: string;
    title: string;
    selector: string;
    scope: string;
    page: ApiPageModel;
}

export function servicePage(service: ScannedService): ApiPageModel {
    const { className, importPath, provision, api } = service;

    return {
        kind: 'service',
        className,
        description: api.description,
        chips: [
            ...deprecationChip(api.tags),
            ...valueChip('Since', api.tags.since),
            { label: 'Provided in', value: provision === 'auto' ? 'root/automatically' : 'providers' },
            ...valueChip('Entry point', importPath)
        ],
        see: api.tags.see ?? [],
        usage: generateServiceUsage(service),
        setup: api.setup,
        examples: api.tags.example ?? [],
        properties: api.properties,
        methods: api.methods,
        types: api.types
    };
}

export function pipePage(pipe: ScannedPipe): ApiPageModel {
    const { className, importPath, pipeName, pure, api } = pipe;

    return {
        kind: 'pipe',
        className,
        description: api.description,
        chips: [
            ...deprecationChip(api.tags),
            { label: 'Pipe', value: pipeName },
            // Unreadable purity is no reason to guess: the chip goes.
            ...(pure === undefined ? [] : [{ label: pure ? 'Pure' : 'Impure' }]),
            ...valueChip('Since', api.tags.since),
            ...valueChip('Entry point', importPath)
        ],
        see: api.tags.see ?? [],
        usage: generatePipeUsage(pipe),
        setup: api.setup,
        examples: api.tags.example ?? [],
        transform: api.transform,
        types: api.types
    };
}

export function componentApiPage(component: ScannedComponent): ApiPageModel {
    const { className, importPath, inputs, outputs, componentMeta, showcaseConfig, api } = component;
    // The jsdoc plugin's own data, for a component that has no `api`: one a plugin hook built, or one from the manifest of an older core.
    const jsdoc = showcaseConfig.meta?.['jsdoc'] as JsDocData | undefined;
    const description = api ? api.description : jsdoc?.classDescription;
    const tags: ApiDocTags = api ? api.tags : (jsdoc?.classTags ?? {});
    const memberTags = jsdoc?.memberTags ?? {};

    const outputRows: ApiOutputRow[] = outputs.map((output) => ({
        name: output.alias ?? output.name,
        payload: api?.outputTypes[output.name],
        description: output.doc,
        tags: memberTags[output.name] ?? {}
    }));

    // Angular adds the change event of a `model()` by itself, so the scanner has no output for it.
    for (const change of api?.modelChanges ?? []) {
        const input = inputs.find((candidate) => candidate.name === change.input);
        const publicName = input ? (input.alias ?? input.name) : change.input;

        outputRows.push({
            name: change.event,
            payload: change.type,
            description: `Emits when \`${publicName}\` changes; bind both ways with \`[(${publicName})]\`.`,
            tags: memberTags[change.input] ?? {}
        });
    }

    return {
        kind: componentMeta.isDirective ? 'directive' : 'component',
        className,
        description,
        chips: [...deprecationChip(tags), ...valueChip('Version', tags.version), ...valueChip('Since', tags.since), ...valueChip('Entry point', importPath)],
        see: tags.see ?? [],
        usage: generateComponentUsage(component),
        setup: [],
        examples: tags.example ?? [],
        inputs: inputs.map((input) => ({
            name: input.alias ?? input.name,
            type: api?.inputTypes[input.name] ?? { text: input.rawType ?? input.type },
            defaultValue: input.defaultValue === undefined ? undefined : formatDefaultValue(input.defaultValue),
            required: input.required,
            description: input.doc,
            tags: memberTags[input.name] ?? {}
        })),
        outputs: outputRows,
        methods: api ? api.methods : (jsdoc?.methods ?? []).map(methodSignature),
        types: api?.types ?? []
    };
}

/** The API pages of a component's parts, in the order the manifest lists them. Each is a component page of its own: the usage has the part's import. */
export function partPages(parts: readonly { meta: ScannedComponent }[] | undefined): ApiPagePart[] {
    const keys = partKeys((parts ?? []).map(({ meta }) => meta.className));

    return (parts ?? []).map(({ meta }, index) => ({
        className: meta.className,
        key: keys[index],
        title: meta.showcaseConfig.title,
        selector: meta.componentMeta.selector,
        scope: partScope(index),
        page: componentApiPage(meta)
    }));
}

/** The deprecation leads the chips, with its message when the tag has one. */
function deprecationChip({ deprecated }: ApiDocTags): ApiPageChip[] {
    if (!deprecated) return [];
    return [{ label: 'Deprecated', ...(typeof deprecated === 'string' ? { value: deprecated } : {}), deprecated: true }];
}

function valueChip(label: string, value: string | undefined): ApiPageChip[] {
    return value ? [{ label, value }] : [];
}

/** A method of the jsdoc plugin's data as a signature: it knows no more of the types than their names. */
function methodSignature(method: MethodDoc): ApiMethod {
    return {
        name: method.name,
        params: method.params.map((param) => ({
            name: param.name,
            type: { text: param.type ?? 'unknown' },
            optional: false,
            description: param.description
        })),
        returnType: { text: method.returnType ?? 'void' },
        description: method.description,
        tags: method.tags
    };
}
