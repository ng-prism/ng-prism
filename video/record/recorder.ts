// Records one shot as a 3840×2160 video. Playwright's recordVideo and the CDP screencast cannot record at 2× (see the
// spike notes), so the recorder slows the page's animations down by SLOW, takes screenshot after screenshot, and
// stretches the result back to real time with ffmpeg. Every wait of a shot is scaled by the same factor.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { RECORDING_SCALE, type FocusMark, type RecordingInfo } from '../src/lib/recordings.ts';
import { CURSOR_SCRIPT } from './cursor.ts';
import type { Shot, ShotContext } from './shots/shot.ts';

export const RECORDING_FPS = 60;
export const SLOW = 10;
const VIEWPORT = { width: 1920, height: 1080 };
const SCALE = RECORDING_SCALE;

/** The fonts the styleguide loads from Google Fonts (video-lib-prism's index.html). */
const STYLEGUIDE_FONTS = ['Inter', 'JetBrains Mono'];

/**
 * The styleguide fonts the page could not load. `document.fonts.ready` resolves when a font failed too, and the page
 * then draws in a system font: offline, or with Google Fonts blocked, every recording would.
 */
export async function missingFonts(page: Page): Promise<string[]> {
    return page.evaluate(async (families) => {
        const missing: string[] = [];
        for (const family of families) {
            const faces = await document.fonts.load(`16px "${family}"`).catch(() => []);
            if (faces.length === 0) missing.push(family);
        }
        return missing;
    }, STYLEGUIDE_FONTS);
}

function ffprobeDuration(file: string): number {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
}

export async function recordShot(shot: Shot, baseUrl: string, outDir: string): Promise<RecordingInfo> {
    mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'dark' });
        await context.addInitScript(CURSOR_SCRIPT);
        const page = await context.newPage();
        await page.goto(`${baseUrl}/?${shot.query}`);
        await page.waitForSelector(shot.ready);
        // The text caret blinks in wall time, not with the slowed animations: stretched to real time it would flicker
        // ten times too fast. A caret that stays on reads as typing, as in an editor.
        await page.addStyleTag({ content: '* { caret-animation: manual !important; }' });
        await page.evaluate('document.fonts.ready');
        const missing = await missingFonts(page);
        if (missing.length > 0) {
            throw new Error(`Shot ${shot.id}: the styleguide could not load ${missing.join(' and ')}; it loads them from Google Fonts. Offline?`);
        }
        await page.waitForTimeout(500);

        const cdp = await context.newCDPSession(page);
        await cdp.send('Animation.enable');
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });

        const framesDir = join(outDir, `${shot.id}.frames`);
        rmSync(framesDir, { recursive: true, force: true });
        mkdirSync(framesDir, { recursive: true });
        const frames: Array<{ name: string; at: number }> = [];
        const focus: FocusMark[] = [];
        const clicks: number[] = [];
        const t0 = Date.now();
        const now = () => (Date.now() - t0) / 1000 / SLOW;
        let pointer = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.6 };

        let capturing = true;
        const capture = (async () => {
            while (capturing) {
                const name = `f${String(frames.length).padStart(5, '0')}.png`;
                const at = now();
                await page.screenshot({ path: join(framesDir, name), caret: 'initial' });
                frames.push({ name, at });
            }
        })();

        const move = async (x: number, y: number, ms: number) => {
            const steps = Math.max(1, Math.round(ms / (1000 / RECORDING_FPS)));
            const from = pointer;
            const start = Date.now();
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
                await page.mouse.move(from.x + (x - from.x) * ease, from.y + (y - from.y) * ease);
                // Wait for the step's slot, not a fixed time: the move itself costs wall time, which would add up.
                await page.waitForTimeout(Math.max(0, start + (i * ms * SLOW) / steps - Date.now()));
            }
            pointer = { x, y };
        };
        const ctx: ShotContext = {
            page,
            mark: async (name: string, target: Locator) => {
                const rect = unionBox(await Promise.all((await target.all()).map((element) => element.boundingBox())));
                if (!rect) throw new Error(`Shot ${shot.id}: mark "${name}" has no box`);
                focus.push({ name, at: now(), rect });
            },
            pause: (ms) => page.waitForTimeout(ms * SLOW),
            move,
            click: async (target, ms = 450) => {
                const box = await target.boundingBox();
                if (!box) throw new Error(`Shot ${shot.id}: click target has no box`);
                await move(box.x + box.width / 2, box.y + box.height / 2, ms);
                clicks.push(now());
                await page.mouse.down();
                await page.waitForTimeout(90 * SLOW);
                await page.mouse.up();
            },
            type: (text, perCharMs) => page.keyboard.type(text, { delay: perCharMs * SLOW })
        };

        try {
            await page.mouse.move(pointer.x, pointer.y);
            await shot.run(ctx);
        } finally {
            // Stop the loop before the browser closes, so a failing shot reports its own error, not the loop's.
            capturing = false;
            await capture.catch(() => {});
        }

        let list = '';
        frames.forEach((frame, i) => {
            const next = frames[i + 1];
            list += `file '${frame.name}'\nduration ${(next ? next.at - frame.at : 1 / RECORDING_FPS).toFixed(5)}\n`;
        });
        list += `file '${frames.at(-1)!.name}'\n`;
        writeFileSync(join(framesDir, 'list.txt'), list);
        const file = `${shot.id}.mp4`;
        execFileSync('ffmpeg', [
            '-y',
            '-loglevel',
            'error',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            join(framesDir, 'list.txt'),
            '-vf',
            `fps=${RECORDING_FPS}`,
            '-c:v',
            'libx264',
            '-crf',
            '12',
            '-preset',
            'medium',
            '-pix_fmt',
            'yuv420p',
            join(outDir, file)
        ]);
        rmSync(framesDir, { recursive: true, force: true });
        return {
            id: shot.id,
            file,
            durationSec: ffprobeDuration(join(outDir, file)),
            width: VIEWPORT.width * SCALE,
            height: VIEWPORT.height * SCALE,
            fps: RECORDING_FPS,
            focus,
            clicks
        };
    } finally {
        await browser.close();
    }
}

type Box = { x: number; y: number; width: number; height: number };

/** The rectangle around every visible box, or null when there is none. */
function unionBox(boxes: Array<Box | null>): Box | null {
    const visible = boxes.filter((box): box is Box => box !== null);
    if (visible.length === 0) return null;
    const x = Math.min(...visible.map((box) => box.x));
    const y = Math.min(...visible.map((box) => box.y));
    return {
        x,
        y,
        width: Math.max(...visible.map((box) => box.x + box.width)) - x,
        height: Math.max(...visible.map((box) => box.y + box.height)) - y
    };
}
