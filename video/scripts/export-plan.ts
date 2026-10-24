// The ffmpeg arguments of the exports. Pure, so tested.

/** H.264 at crf 18 for the web; ffmpeg ignores the audio options when the master has no audio. */
export function mp4Args(input: string, output: string): string[] {
    return [
        '-v',
        'error',
        '-y',
        '-i',
        input,
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        output
    ];
}

/** The last frame as an 8-bit RGB PNG; as-is, the ProRes master's 16-bit RGBA makes a 9 MB poster. */
export function posterArgs(input: string, output: string): string[] {
    return ['-v', 'error', '-y', '-sseof', '-0.05', '-i', input, '-update', '1', '-pix_fmt', 'rgb24', output];
}
