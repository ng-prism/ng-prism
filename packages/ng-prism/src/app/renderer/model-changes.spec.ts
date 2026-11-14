import type { InputMeta, RuntimeComponent } from '../../plugin/plugin.types.js';
import { COMPOSITION_SUBJECT_SLOT } from '../../shared/composition.js';
import { modelChangeSources } from './model-changes.js';

const VALUE: InputMeta = { name: 'value', type: 'date', required: false, model: true };
const LABEL: InputMeta = { name: 'label', type: 'string', required: false };

function makeComp(options: { inputs?: InputMeta[]; isDirective?: boolean; composition?: RuntimeComponent['meta']['composition'] } = {}): RuntimeComponent {
    const type = class {} as any;

    return {
        type,
        ...(options.composition && { composition: type }),
        meta: {
            className: 'Comp',
            filePath: '/test.ts',
            showcaseConfig: { title: 'Test' },
            inputs: options.inputs ?? [LABEL, VALUE],
            outputs: [],
            componentMeta: { selector: 'test', standalone: true, isDirective: options.isDirective ?? false },
            ...(options.composition && { composition: options.composition })
        }
    };
}

describe('modelChangeSources', () => {
    it('listens to the model signal of a component it renders itself', () => {
        expect(modelChangeSources(makeComp(), 0)).toEqual([{ input: 'value', member: 'value', event: 'valueChange' }]);
    });

    it('listens to the change output of the host that renders a directive', () => {
        expect(modelChangeSources(makeComp({ isDirective: true }), 0)).toEqual([{ input: 'value', member: 'valueChange', event: 'valueChange' }]);
    });

    it('names the event as Angular names the output of an aliased model', () => {
        expect(modelChangeSources(makeComp({ inputs: [{ ...VALUE, alias: 'date' }] }), 0)).toEqual([{ input: 'value', member: 'value', event: 'dateChange' }]);
    });

    it('listens to the composition wrapper in a composed variant, and only where its case binds the model', () => {
        const comp = makeComp({
            composition: {
                variantCases: [0, 1],
                cases: [
                    { template: `<x${COMPOSITION_SUBJECT_SLOT} />`, unbound: [] },
                    { template: `<x${COMPOSITION_SUBJECT_SLOT} [value]="v" />`, unbound: [{ name: 'value', reason: 'template' }] }
                ]
            }
        });

        expect(modelChangeSources(comp, 0)).toEqual([{ input: 'value', member: 'valueChange', event: 'valueChange' }]);
        expect(modelChangeSources(comp, 1)).toEqual([]);
    });

    // The wrapper's `valueChange` is then that output, which the renderer already hears as one, not the model's change.
    it.each([
        ['the member', { name: 'valueChange' }],
        ['the event', { name: 'other', alias: 'valChange' }]
    ])('does not listen to the host where an output of the directive takes the name of %s', (_, output) => {
        const comp = makeComp({ inputs: [{ ...VALUE, alias: 'val' }], isDirective: true });

        comp.meta.outputs = [output];

        expect(modelChangeSources(comp, 0)).toEqual([]);
    });

    it('lists nothing for a component without a model', () => {
        expect(modelChangeSources(makeComp({ inputs: [LABEL] }), 0)).toEqual([]);
    });
});
