export interface CaptionPart {
    text: string;
    emphasis: boolean;
}

/** Splits a caption written with `**…**` into plain and emphasised parts. Empty parts are left out. */
export function parseEmphasis(text: string): CaptionPart[] {
    const pieces = text.split('**');
    if (pieces.length % 2 === 0) throw new Error(`Unbalanced ** in "${text}"`);
    return pieces.map((piece, index) => ({ text: piece, emphasis: index % 2 === 1 })).filter((part) => part.text !== '');
}
