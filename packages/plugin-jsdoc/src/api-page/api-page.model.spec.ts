import type { ApiMethod, ApiSetupEntry, ApiTypeDoc, ComponentApi, InputMeta, ScannedComponent, ScannedPipe, ScannedService } from '@ng-prism/core/plugin';
import type { JsDocData } from '../jsdoc.types.js';
import { componentApiPage, partPages, pipePage, servicePage } from './api-page.model.js';
import { generateComponentUsage } from './component-usage.js';
import { generatePipeUsage } from './pipe-usage.js';
import { generateServiceUsage } from './service-usage.js';

const SETUP: ApiSetupEntry = { name: 'provideToast', kind: 'function', importPath: 'fixture/toast', tags: {}, params: [] };
const METHOD: ApiMethod = { name: 'show', params: [], returnType: { text: 'void' }, tags: {} };
const TYPE: ApiTypeDoc = { id: 'ToastRef', name: 'ToastRef', kind: 'interface', importPath: 'fixture/toast', tags: {}, properties: [] };

function makeService(overrides: Partial<ScannedService> = {}, api: Partial<ScannedService['api']> = {}): ScannedService {
    return {
        className: 'ToastService',
        filePath: '/lib/toast.service.ts',
        importPath: 'fixture/toast',
        showcaseConfig: { title: 'Toast Service' },
        provision: 'auto',
        api: { tags: {}, properties: [], methods: [], setup: [], types: [], ...api },
        ...overrides
    };
}

function makePipe(overrides: Partial<ScannedPipe> = {}, api: Partial<ScannedPipe['api']> = {}): ScannedPipe {
    return {
        className: 'TimeAgoPipe',
        filePath: '/lib/time-ago.pipe.ts',
        importPath: 'test-lib',
        showcaseConfig: { title: 'Time Ago' },
        pipeName: 'timeAgo',
        pure: true,
        api: { tags: {}, transform: [], setup: [], types: [], ...api },
        ...overrides
    };
}

function makeComponent(overrides: Partial<ScannedComponent> = {}, api?: Partial<ComponentApi>): ScannedComponent {
    return {
        className: 'TabsComponent',
        filePath: '/lib/tabs.component.ts',
        importPath: 'test-lib',
        showcaseConfig: { title: 'Tabs' },
        inputs: [],
        outputs: [],
        componentMeta: { selector: 'sg-tabs', standalone: true, isDirective: false },
        ...(api && { api: { tags: {}, inputTypes: {}, outputTypes: {}, modelChanges: [], methods: [], types: [], ...api } }),
        ...overrides
    };
}

function withJsDoc(jsdoc: JsDocData, overrides: Partial<ScannedComponent> = {}): ScannedComponent {
    return makeComponent({ showcaseConfig: { title: 'Tabs', meta: { jsdoc } }, ...overrides });
}

describe('servicePage', () => {
    it('shows the chips of the service page', () => {
        expect(servicePage(makeService({}, { tags: { since: '1.2.0' } })).chips).toEqual([
            { label: 'Since', value: '1.2.0' },
            { label: 'Provided in', value: 'root/automatically' },
            { label: 'Entry point', value: 'fixture/toast' }
        ]);
    });

    it('puts the deprecation first, with its message when it has one', () => {
        expect(servicePage(makeService({}, { tags: { deprecated: 'Use NoticeService.' } })).chips[0]).toEqual({
            label: 'Deprecated',
            value: 'Use NoticeService.',
            deprecated: true
        });
        expect(servicePage(makeService({}, { tags: { deprecated: true } })).chips[0]).toEqual({ label: 'Deprecated', deprecated: true });
    });

    it('says a manual service goes into providers and leaves out what is unknown', () => {
        expect(servicePage(makeService({ provision: 'manual', importPath: undefined })).chips).toEqual([{ label: 'Provided in', value: 'providers' }]);
    });

    it('hands over the sections of the service API', () => {
        const property = { name: 'count', type: { text: 'number' }, readonly: true, tags: {} };
        const service = makeService(
            {},
            {
                description: 'Shows toasts.',
                tags: { see: ['NoticeService'], example: ['inject(ToastService)'] },
                properties: [property],
                methods: [METHOD],
                setup: [SETUP],
                types: [TYPE]
            }
        );

        expect(servicePage(service)).toStrictEqual({
            kind: 'service',
            className: 'ToastService',
            description: 'Shows toasts.',
            chips: expect.any(Array),
            see: ['NoticeService'],
            usage: generateServiceUsage(service),
            setup: [SETUP],
            examples: ['inject(ToastService)'],
            properties: [property],
            methods: [METHOD],
            types: [TYPE]
        });
    });
});

describe('pipePage', () => {
    it('shows the template name and purity first', () => {
        expect(pipePage(makePipe({}, { tags: { since: '2.0.0' } })).chips).toEqual([
            { label: 'Pipe', value: 'timeAgo' },
            { label: 'Pure' },
            { label: 'Since', value: '2.0.0' },
            { label: 'Entry point', value: 'test-lib' }
        ]);
    });

    it('says when a pipe is impure', () => {
        expect(pipePage(makePipe({ pure: false })).chips).toContainEqual({ label: 'Impure' });
    });

    it('leaves the purity out when it could not be read', () => {
        expect(pipePage(makePipe({ pure: undefined, importPath: undefined })).chips).toEqual([{ label: 'Pipe', value: 'timeAgo' }]);
    });

    it('puts the deprecation first, as on a service page', () => {
        expect(pipePage(makePipe({}, { tags: { deprecated: true } })).chips[0]).toEqual({ label: 'Deprecated', deprecated: true });
    });

    it('hands over the transform signatures and no members', () => {
        const pipe = makePipe({}, { description: 'Relative time.', tags: { example: ['{{ date | timeAgo }}'] }, transform: [METHOD], setup: [SETUP], types: [TYPE] });

        expect(pipePage(pipe)).toStrictEqual({
            kind: 'pipe',
            className: 'TimeAgoPipe',
            description: 'Relative time.',
            chips: expect.any(Array),
            see: [],
            usage: generatePipeUsage(pipe),
            setup: [SETUP],
            examples: ['{{ date | timeAgo }}'],
            transform: [METHOD],
            types: [TYPE]
        });
    });
});

describe('componentApiPage', () => {
    const TABS_INPUT: InputMeta = { name: 'items', alias: 'tabs', type: 'array', rawType: 'TabItem[]', required: true, doc: 'The tabs.' };

    it('shows the chips of the component page', () => {
        const component = makeComponent({}, { tags: { deprecated: 'Use X.', version: '2.1.0', since: '1.0.0' } });

        expect(componentApiPage(component).chips).toEqual([
            { label: 'Deprecated', value: 'Use X.', deprecated: true },
            { label: 'Version', value: '2.1.0' },
            { label: 'Since', value: '1.0.0' },
            { label: 'Entry point', value: 'test-lib' }
        ]);
    });

    it('leaves out the chips it has no value for', () => {
        expect(componentApiPage(makeComponent({ importPath: undefined }, { tags: { deprecated: true } })).chips).toEqual([{ label: 'Deprecated', deprecated: true }]);
        expect(componentApiPage(makeComponent({ importPath: undefined }, {})).chips).toEqual([]);
    });

    it('is a component page, or a directive page for a directive', () => {
        const directive = makeComponent({ componentMeta: { selector: '[fxHint]', standalone: true, isDirective: true } }, {});

        expect(componentApiPage(makeComponent({}, {})).kind).toBe('component');
        expect(componentApiPage(directive).kind).toBe('directive');
    });

    it('takes description, tags and examples from the api', () => {
        const page = componentApiPage(makeComponent({}, { description: 'Tabs.', tags: { see: ['AccordionComponent'], example: ['<sg-tabs />'] } }));

        expect(page).toMatchObject({ className: 'TabsComponent', description: 'Tabs.', see: ['AccordionComponent'], examples: ['<sg-tabs />'], setup: [] });
    });

    it('describes the component by its generated usage', () => {
        const component = makeComponent({ inputs: [TABS_INPUT] }, {});

        expect(componentApiPage(component).usage).toBe(generateComponentUsage(component));
    });

    it('shows an input by its public name, with the type of the api and what the code says of it', () => {
        const component = makeComponent(
            { inputs: [TABS_INPUT], showcaseConfig: { title: 'Tabs', meta: { jsdoc: { classTags: {}, memberTags: { items: { since: '1.1.0' } } } } } },
            { inputTypes: { items: { text: 'TabItem[]', links: ['TabItem'] } } }
        );

        expect(componentApiPage(component).inputs).toEqual([
            { name: 'tabs', type: { text: 'TabItem[]', links: ['TabItem'] }, required: true, description: 'The tabs.', tags: { since: '1.1.0' } }
        ]);
    });

    it('writes defaults as the code does: strings quoted, arrays and objects as JSON, the rest as is', () => {
        const component = makeComponent(
            {
                inputs: [
                    { name: 'variant', type: 'string', required: false, defaultValue: 'filled' },
                    { name: 'disabled', type: 'boolean', required: false, defaultValue: false },
                    { name: 'count', type: 'number', required: false, defaultValue: 0 },
                    { name: 'parent', type: 'string | null', required: false, defaultValue: null },
                    { name: 'tabs', type: 'TabItem[]', required: false, defaultValue: [] },
                    { name: 'ids', type: 'string[]', required: false, defaultValue: ['a', 'b'] },
                    { name: 'config', type: 'Config', required: false, defaultValue: { size: 'm' } },
                    { name: 'since', type: 'date', required: false, defaultValue: new Date(2026, 0, 1) },
                    { name: 'label', type: 'string', required: false }
                ]
            },
            {}
        );

        expect(componentApiPage(component).inputs?.map((row) => row.defaultValue)).toEqual([
            "'filled'",
            'false',
            '0',
            'null',
            '[]',
            '["a","b"]',
            '{"size":"m"}',
            '2026-01-01',
            undefined
        ]);
    });

    it('shows an output by its public name with its payload, then one for each model', () => {
        const component = makeComponent(
            {
                outputs: [{ name: 'tabSelected', alias: 'selected', doc: 'A tab was picked.' }],
                inputs: [{ name: 'activeTabId', type: 'string', required: false }],
                showcaseConfig: { title: 'Tabs', meta: { jsdoc: { classTags: {}, memberTags: { tabSelected: { since: '1.2.0' } } } } }
            },
            {
                outputTypes: { tabSelected: { text: 'TabItem', links: ['TabItem'] } },
                modelChanges: [{ input: 'activeTabId', event: 'activeTabIdChange', type: { text: 'string' } }]
            }
        );

        expect(componentApiPage(component).outputs).toEqual([
            { name: 'selected', payload: { text: 'TabItem', links: ['TabItem'] }, description: 'A tab was picked.', tags: { since: '1.2.0' } },
            {
                name: 'activeTabIdChange',
                payload: { text: 'string' },
                description: 'Emits when `activeTabId` changes; bind both ways with `[(activeTabId)]`.',
                tags: {}
            }
        ]);
    });

    it('names the aliased input of a model in its change output', () => {
        const component = makeComponent(
            { inputs: [{ name: 'active', alias: 'activeTab', type: 'string', required: false }] },
            { modelChanges: [{ input: 'active', event: 'activeTabChange', type: { text: 'string' } }] }
        );

        expect(componentApiPage(component).outputs).toEqual([
            { name: 'activeTabChange', payload: { text: 'string' }, description: 'Emits when `activeTab` changes; bind both ways with `[(activeTab)]`.', tags: {} }
        ]);
    });

    it('hands over the methods and types of the api', () => {
        const page = componentApiPage(makeComponent({}, { methods: [METHOD], types: [TYPE] }));

        expect(page.methods).toEqual([METHOD]);
        expect(page.types).toEqual([TYPE]);
    });

    it('has no properties and no transform: those are for services and pipes', () => {
        expect(Object.keys(componentApiPage(makeComponent({}, {})))).not.toEqual(expect.arrayContaining(['properties', 'transform']));
    });

    describe('without the api of the scanner', () => {
        const JSDOC: JsDocData = {
            classDescription: 'Tabs from the comment.',
            classTags: { deprecated: true, since: '1.0.0', see: ['Accordion'], example: ['<sg-tabs />'] },
            memberTags: { items: { since: '1.1.0' } },
            methods: [
                {
                    name: 'select',
                    description: 'Selects a tab.',
                    tags: { since: '1.3.0' },
                    params: [{ name: 'id', type: 'string', description: 'The tab id.' }, { name: 'options' }],
                    returnType: 'boolean'
                },
                { name: 'reset', tags: {}, params: [] }
            ]
        };

        it('reads description and tags from the jsdoc data', () => {
            const page = componentApiPage(withJsDoc(JSDOC));

            expect(page.description).toBe('Tabs from the comment.');
            expect(page.chips).toEqual([
                { label: 'Deprecated', deprecated: true },
                { label: 'Since', value: '1.0.0' },
                { label: 'Entry point', value: 'test-lib' }
            ]);
            expect(page.see).toEqual(['Accordion']);
            expect(page.examples).toEqual(['<sg-tabs />']);
        });

        it('types the inputs by what they were scanned as and leaves the outputs without a payload', () => {
            const component = withJsDoc(JSDOC, {
                inputs: [TABS_INPUT, { name: 'size', type: 'union', required: false }],
                outputs: [{ name: 'closed' }]
            });
            const page = componentApiPage(component);

            expect(page.inputs).toEqual([
                { name: 'tabs', type: { text: 'TabItem[]' }, required: true, description: 'The tabs.', tags: { since: '1.1.0' } },
                { name: 'size', type: { text: 'union' }, required: false, tags: {} }
            ]);
            expect(page.outputs).toEqual([{ name: 'closed', tags: {} }]);
        });

        it('turns the documented methods into signatures and has no types', () => {
            const page = componentApiPage(withJsDoc(JSDOC));

            expect(page.methods).toEqual([
                {
                    name: 'select',
                    description: 'Selects a tab.',
                    tags: { since: '1.3.0' },
                    params: [
                        { name: 'id', type: { text: 'string' }, optional: false, description: 'The tab id.' },
                        { name: 'options', type: { text: 'unknown' }, optional: false }
                    ],
                    returnType: { text: 'boolean' }
                },
                { name: 'reset', tags: {}, params: [], returnType: { text: 'void' } }
            ]);
            expect(page.types).toEqual([]);
        });

        it('shows what it has of a component without any jsdoc data', () => {
            const page = componentApiPage(makeComponent({ inputs: [TABS_INPUT] }));

            expect(page).toMatchObject({ description: undefined, chips: [{ label: 'Entry point', value: 'test-lib' }], see: [], examples: [], methods: [], types: [] });
            expect(page.inputs).toEqual([{ name: 'tabs', type: { text: 'TabItem[]' }, required: true, description: 'The tabs.', tags: {} }]);
        });
    });
});

describe('partPages', () => {
    const option = makeComponent(
        {
            className: 'OptionComponent',
            importPath: 'test-lib/select',
            inputs: [{ name: 'value', type: 'string', required: true }],
            componentMeta: { selector: 'lib-option', standalone: true, isDirective: false },
            showcaseConfig: { title: 'Option', partOf: 'lib-select' }
        },
        { description: 'One option of a select.' }
    );
    const group = makeComponent(
        {
            className: 'OptionGroupComponent',
            componentMeta: { selector: '[libOptionGroup]', standalone: true, isDirective: true },
            showcaseConfig: { title: 'Option group', partOf: 'lib-select' }
        },
        {}
    );

    it('is empty for a component without parts', () => {
        expect(partPages(undefined)).toEqual([]);
        expect(partPages([])).toEqual([]);
    });

    it('describes a part by its class, key, title and selector, and scopes it by its position', () => {
        expect(partPages([{ meta: option }])[0]).toMatchObject({
            className: 'OptionComponent',
            key: 'OptionComponent',
            title: 'Option',
            selector: 'lib-option',
            scope: 'part-0'
        });
    });

    it("gives a part page its own usage with the part's import", () => {
        const [part] = partPages([{ meta: option }]);

        expect(part.page.usage).toBe(generateComponentUsage(option));
        expect(part.page.usage).toContain('OptionComponent');
        expect(part.page.usage).toContain('test-lib/select');
    });

    it('builds the page of the part, as the page of any component', () => {
        expect(partPages([{ meta: option }])[0].page).toEqual(componentApiPage(option));
        expect(partPages([{ meta: option }])[0].page).toMatchObject({ kind: 'component', className: 'OptionComponent', description: 'One option of a select.' });
    });

    it('keeps the order of the parts and knows a directive part by its page', () => {
        const pages = partPages([{ meta: group }, { meta: option }]);

        expect(pages.map((part) => part.className)).toEqual(['OptionGroupComponent', 'OptionComponent']);
        expect(pages[0].page.kind).toBe('directive');
    });
});
