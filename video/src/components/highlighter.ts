import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { parser } from '@lezer/javascript';
import { LezerHighlighter } from '@revideo/2d';
import { CODE_COLORS, TEXT } from '../brand.ts';

/** TypeScript in the colours of the styleguide's own code view (dark theme). */
export const tsHighlighter = new LezerHighlighter(
    parser.configure({ dialect: 'ts' }),
    HighlightStyle.define([
        { tag: [tags.meta, tags.annotation, tags.keyword, tags.modifier, tags.definitionKeyword, tags.moduleKeyword, tags.controlKeyword], color: CODE_COLORS.tag },
        { tag: [tags.propertyName, tags.definition(tags.propertyName), tags.typeName, tags.className], color: CODE_COLORS.attr },
        { tag: [tags.string, tags.special(tags.string), tags.number, tags.bool], color: CODE_COLORS.str },
        { tag: [tags.comment, tags.lineComment, tags.blockComment], color: CODE_COLORS.com },
        { tag: [tags.punctuation, tags.bracket, tags.operator, tags.separator], color: TEXT.muted },
        { tag: [tags.variableName, tags.function(tags.variableName)], color: TEXT.primary }
    ])
);
