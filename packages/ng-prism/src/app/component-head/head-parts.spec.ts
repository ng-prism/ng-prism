import type { InputMeta, OutputMeta, RuntimePart, ScannedComponent } from '../../plugin/plugin.types.js';
import { formatPartDefault, partChips } from './head-parts.js';

function part(
    className: string,
    patch: { title?: string; selector?: string; description?: string; status?: 'wip'; inputs?: InputMeta[]; outputs?: OutputMeta[] } = {}
): RuntimePart {
    const meta: ScannedComponent = {
        className,
        filePath: `/lib/${className}.ts`,
        showcaseConfig: { title: patch.title ?? className, description: patch.description, status: patch.status },
        inputs: patch.inputs ?? [],
        outputs: patch.outputs ?? [],
        componentMeta: { selector: patch.selector ?? 'lib-part', standalone: true, isDirective: false }
    };

    return { meta };
}

const option = part('OptionComponent', {
    title: 'Option',
    selector: 'lib-option',
    inputs: [
        { name: 'value', type: 'unknown', required: true, doc: 'The value this option selects.' },
        { name: 'disabled', alias: 'isDisabled', type: 'boolean', rawType: 'boolean', defaultValue: false, required: false }
    ],
    outputs: [{ name: 'remove' }]
});

const optgroup = part('OptgroupComponent', { title: 'Option Group', selector: 'lib-optgroup' });

describe('partChips', () => {
    it('turns a part into a chip with its API rows', () => {
        const [chip] = partChips([option]);

        expect(chip).toEqual(
            expect.objectContaining({
                className: 'OptionComponent',
                title: 'Option',
                selector: 'lib-option',
                popoverId: 'prism-part-0',
                anchorName: '--prism-part-0'
            })
        );
        expect(chip.inputs).toEqual([
            { name: 'value', type: 'unknown', required: true, doc: 'The value this option selects.' },
            { name: 'isDisabled', type: 'boolean', defaultValue: 'false', required: false, doc: undefined }
        ]);
        expect(chip.outputs).toEqual([{ name: 'remove', doc: undefined }]);
    });

    it('names an input or an output by its alias, as a template binds it', () => {
        const [chip] = partChips([part('P', { inputs: [{ name: 'a', alias: 'b', type: 'string', required: false }], outputs: [{ name: 'c', alias: 'd' }] })]);

        expect(chip.inputs[0].name).toBe('b');
        expect(chip.outputs[0].name).toBe('d');
    });

    it('shows the type as it is written in the source when the scan kept it', () => {
        const [chip] = partChips([part('P', { inputs: [{ name: 'a', type: 'union', rawType: "'sm' | 'md'", required: false }] })]);

        expect(chip.inputs[0].type).toBe("'sm' | 'md'");
    });

    it('keeps the given order', () => {
        expect(partChips([optgroup, option]).map((c) => c.title)).toEqual(['Option Group', 'Option']);
    });

    it('gives every part its own popover id and anchor name', () => {
        const ids = partChips([option, optgroup])
            .map((c) => [c.popoverId, c.anchorName])
            .flat();

        expect(new Set(ids).size).toBe(4);
    });

    it('gives two parts of one class name, from different files, a popover id and anchor name each', () => {
        const twin = { meta: { ...option.meta, filePath: '/lib/other/OptionComponent.ts' } };
        const chips = partChips([option, twin]);

        expect(chips.map((c) => c.className)).toEqual(['OptionComponent', 'OptionComponent']);
        expect(new Set(chips.map((c) => c.popoverId)).size).toBe(2);
        expect(new Set(chips.map((c) => c.anchorName)).size).toBe(2);
    });

    it('keys a part by its class name, and the second of a class name that two parts share with ~2', () => {
        const twin = { meta: { ...option.meta, filePath: '/lib/other/OptionComponent.ts' } };

        expect(partChips([option, optgroup, twin]).map((c) => c.key)).toEqual(['OptionComponent', 'OptgroupComponent', 'OptionComponent~2']);
    });

    it('lists the change output Angular adds for a model() after the declared outputs, by the name a template binds', () => {
        const [chip] = partChips([
            part('P', {
                inputs: [
                    { name: 'selected', type: 'boolean', required: false, model: true },
                    { name: 'open', alias: 'expanded', type: 'boolean', required: false, model: true },
                    { name: 'label', type: 'string', required: false }
                ],
                outputs: [{ name: 'remove' }]
            })
        ]);

        expect(chip.outputs.map((row) => row.name)).toEqual(['remove', 'selectedChange', 'expandedChange']);
        expect(chip.outputs[1].doc).toBe('Emits when selected changes; bind both ways with [(selected)].');
    });

    it('carries the description and the status badge of the part', () => {
        const [chip] = partChips([part('P', { description: 'One choice.', status: 'wip' })]);

        expect(chip.description).toBe('One choice.');
        expect(chip.status).toEqual(expect.objectContaining({ label: 'Work in progress' }));
        expect(partChips([optgroup])[0].status).toBeNull();
    });

    it('has no chips for a component without parts', () => {
        expect(partChips(undefined)).toEqual([]);
        expect(partChips([])).toEqual([]);
    });
});

describe('formatPartDefault', () => {
    const input = (patch: Partial<InputMeta>): InputMeta => ({ name: 'x', type: 'unknown', required: false, ...patch });

    it.each([
        [undefined, undefined],
        ['x', "'x'"],
        ['', "''"],
        [3, '3'],
        [false, 'false'],
        [null, 'null'],
        [{ a: 1 }, '{"a":1}'],
        [['a', 1], '["a",1]']
    ])('formats the default %p as %p', (value, out) => {
        expect(formatPartDefault(input({ defaultValue: value }))).toBe(out);
    });

    it('escapes a quote and a backslash in a string default, as a template writes it', () => {
        expect(formatPartDefault(input({ defaultValue: "it's" }))).toBe("'it\\'s'");
        expect(formatPartDefault(input({ defaultValue: 'a\\b' }))).toBe("'a\\\\b'");
    });

    it('shows a Date default as its day', () => {
        expect(formatPartDefault(input({ type: 'date', defaultValue: new Date(2026, 0, 1) }))).toBe('2026-01-01');
    });

    it('shows … for a default the scan could not read', () => {
        expect(formatPartDefault(input({ defaultUnreadable: true }))).toBe('…');
    });
});
