import { Layout, Rect, Txt, type LayoutProps } from '@revideo/2d';
import { all, easeInOutCubic, type ThreadGenerator, type Vector2 } from '@revideo/core';
import { FONT_MONO, STATUS, TEXT } from '../brand.ts';

export interface FileTreeProps extends LayoutProps {
    /** The folder, then its files, e.g. `['button/', 'button.component.ts', …]`. */
    entries: string[];
    fontSize?: number;
}

interface Row {
    row: Layout;
    branch: Txt;
    name: Txt;
}

/** A folder and its files in mono type, with the tree drawing of `tree`. */
export class FileTree extends Layout {
    private readonly rows = new Map<string, Row>();
    private readonly textSize: number;

    public constructor({ entries, fontSize = 34, ...props }: FileTreeProps) {
        super({ layout: true, direction: 'column', gap: fontSize * 0.45, ...props });
        this.textSize = fontSize;
        const [folder, ...files] = entries;
        this.add(<Txt text={folder} fontFamily={FONT_MONO} fontWeight={500} fontSize={fontSize} fill={TEXT.secondary} />);
        files.forEach((file, index) => {
            const branch = new Txt({ text: index === files.length - 1 ? '└' : '├', fontFamily: FONT_MONO, fontSize, fill: TEXT.muted });
            const name = new Txt({ text: file, fontFamily: FONT_MONO, fontWeight: 500, fontSize, fill: TEXT.primary });
            const row = new Layout({ layout: true, direction: 'row', alignItems: 'center', gap: fontSize * 0.4, paddingLeft: fontSize * 0.5, children: [branch, name] });
            this.add(row);
            this.rows.set(file, { row, branch, name });
        });
    }

    private entry(name: string): Row {
        const row = this.rows.get(name);
        if (!row) throw new Error(`FileTree has no entry "${name}"`);
        return row;
    }

    /** Where the entry's row sits inside the tree, for a camera move onto it. */
    public entryPosition(name: string): Vector2 {
        return this.entry(name).row.position();
    }

    public *highlight(name: string, color: string, seconds = 0.4): ThreadGenerator {
        yield* this.entry(name).name.fill(color, seconds, easeInOutCubic);
    }

    /** Draws a line through the entry and turns it the danger colour. */
    public *strike(name: string, seconds = 0.5): ThreadGenerator {
        const { row, name: text } = this.entry(name);
        // Outside the row's layout, laid over the name: a line in a Txt would become part of its text.
        const line = new Rect({
            layout: false,
            offset: [-1, 0],
            x: text.position.x() - text.width() / 2,
            y: text.position.y(),
            width: 0,
            height: Math.max(3, this.textSize * 0.09),
            fill: STATUS.danger
        });
        row.add(line);
        yield* all(line.width(text.width(), seconds, easeInOutCubic), text.fill(STATUS.danger, seconds));
    }

    /** Lets the entry fall out of the tree; the entry above it becomes the last branch. */
    public *drop(name: string, seconds = 0.6): ThreadGenerator {
        const { row } = this.entry(name);
        const rest = [...this.rows.keys()].filter((key) => key !== name);
        yield* all(row.opacity(0, seconds, easeInOutCubic), row.margin.top(this.textSize * 0.8, seconds, easeInOutCubic));
        row.remove();
        this.rows.delete(name);
        const last = rest.at(-1);
        if (last) this.entry(last).branch.text('└');
    }
}
