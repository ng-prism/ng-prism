---
name: prism-product-video
description: Makes and updates ng-prism's product videos in `video/` - the tour on the docs start page and the clip per release, recorded from test-workspace's video-lib with Playwright and cut with Revideo. Use when asked to make a release clip, add a beat or a shot, re-record or re-render the videos after a UI change, change the tour, or when a video render hangs, comes out silent or looks wrong.
---

# Product videos — release clips, shots and the tour

`video/` is a standalone npm project (not in the workspaces, not in Nx). `CONTRIBUTING.md` › Product Videos has the setup and the commands; this skill has what the maintainer decided and what costs time.

| Cut           | Built from                                                   | Lands in                                            |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `tour`        | `src/scenes/tour/` + shots reveal, controls, quality, states | `docs/assets/video/tour.mp4` + `tour-poster.png`    |
| `release-<v>` | `releases/<v>.json` + its shots, `src/scenes/release.tsx`    | `video/out/deliver/release-<v>.mp4` (not committed) |

Shots live in `video/record/shots/`, the demo library in `test-workspace/projects/video-lib/`. The code on screen is read from its sources at render time.

## The maintainer's rules

These are decided. Don't trade them for something else; ask when one can't be met.

- **Four No-Gos:** code on screen that differs from the source (never write code into a scene by hand); marketing speak (no superlatives, no emojis: one developer showing another); blurry or jerky pictures (never enlarge a recording beyond ~2× full frame); dead time.
- **Pace.** A viewer must follow what happens and why. Every beat opens with 1.5–2 s of stillness while its caption is read; after every action the effect stays 1.2 s or longer; pointer glides take 0.9–1.7 s; typing in the controls ~130 ms per character.
- **Lengths:** release clip with 1–2 beats 15–25 s, with 3 beats up to ~37 s (accepted for 22.7); version card 2.5 s, `ui` beats 6–10 s, `api` beats 10–14 s (caption, typing at 0.4 s a line, recording), end card 4 s. Tour ~68 s. Pace beats length: shorten by dropping a beat, never by rushing one.
- **Captions:** one line, at most ~45 characters, a full stop, one emphasised part in balanced `**…**`.
- **Sound** only through `cue()`/`typingCues()` in `src/components/sfx.tsx`. Master levels: `max_volume` ≤ −6 dB, `mean_volume` ≤ −28 dB.
- 1920×1080, 60 fps. The end card is the HQ logo (`docs/logo_withtext_big.png`) with the command: `ng add` in the tour, `ng update @ng-prism/core` in release clips.

## Making a release clip

1. **The features must be merged** into your branch. `record` builds the core and plugins itself (Nx-cached) and stops when the styleguide's Google Fonts don't load. Never `npm run test:workspace:update` while the maintainer's styleguide runs on :4400 (it kills it and clears `.angular/cache`) — ask.
2. **Pick 1–3 beats.** A UI feature is a `ui` beat (its recording with a caption). New `@Showcase` API is an `api` beat (the decorator types itself into a video-lib source on the left, the recording plays on the right). A feature only a few pixels big needs `"zoom"` on its beat: the camera moves onto the shot's **first** mark (a `ui` beat up to 2, an `api` beat up to 4; without it a `ui` beat shows the whole frame and an `api` beat zooms by 1.3).
3. **video-lib.** Leave `button/` alone: it is the tour's on-screen code. An `api` source has to fit the code card: from `@Showcase` on at most 80 characters wide and ~24 lines, so template and styles in files (`templateUrl`), not inline. Check first that a feature is really new (`git log -S`) before a caption calls it new.
4. **Write the shot** (`record/shots/<id>.ts`, registered in `index.ts` and `index.test.ts`):
    - every duration is video time; the recorder slows the page 10× and stretches it back;
    - act only through `ctx.click`, `ctx.move`, `ctx.type`: a raw `page.click` gets no click sound and no click time for the camera;
    - `mark()` the element the camera should go to first and as tight as possible: a full-width element centres the zoom on empty space;
    - throw early when the page is not in the expected state (`look` checks dark mode).
5. **Check the selectors in the built styleguide** before recording: serve `test-workspace/dist/video-lib-prism` with `serveStatic` from `record/serve.ts` on a free port and look at it with Playwright. Recording a guessed selector costs minutes.
6. **Write `releases/<v>.json`**, then:

    ```bash
    npm --prefix video run record -- --shot <id> --shot <id2>
    npm --prefix video run render -- release --version <v>
    npm --prefix video run export -- release-<v>
    ```

    `npm run video -- --release <v>` does the same in one go, recording every shot; it leaves the committed tour alone (add `--tour` only when the tour should change too).

7. **Check the cut** (below), then show it to the maintainer against the four No-Gos. Nothing is committed before they say yes.

## Checking a cut

```bash
ffprobe -v error -show_entries stream=codec_name,width,height:format=duration -of csv=p=0 video/out/deliver/<cut>.mp4
ffmpeg -v error -y -i video/out/deliver/<cut>.mp4 -vf "fps=1/1.5,scale=480:-1,tile=4x4" -frames:v 1 sheet.png   # then read the image
ffmpeg -i video/out/masters/<cut>.mov -vn -af volumedetect -f null - 2>&1 | grep _volume
ffmpeg -i video/out/masters/<cut>.mov -vn -af silencedetect=n=-50dB:d=0.3 -f null - 2>&1 | grep -o 'silence_end: [0-9.]*'
```

The sheet shows framing, captions and the camera; look at full frames where the camera zooms. Every `silence_end` should match a click, the typing or the whoosh in the cut's timeline.

## When something goes wrong

| Symptom                                                                | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A render prints nothing for more than 5 min, its Chrome is idle        | The page threw before the scene ran. Renders are silent until the end anyway (release ~1 min, tour ~2.5 min), and Revideo forwards console messages but not page errors. Stop that render by PID (`render.ts` and its Chrome child), not by process name: another recording may run its own Chrome for Testing. Add `page.on('pageerror', (e) => console.log('PAGEERROR', e.message));` above `// Attach logs from puppeteer` in `video/node_modules/@revideo/renderer/lib/server/render-video.js`, render again, remove it. Variables must go through `encodeVariables` (lib/variables.ts): Revideo puts them in a template literal unescaped. |
| `Recordings are stale`                                                 | video-lib or `packages/*/dist` changed since the recording. A cut needs all its shots from the same sources, and `record -- --shot` keeps the other shots only while the sources are unchanged: after a change, record every shot of the cut (`npm run video` records all).                                                                                                                                                                                                                                                                                                                                                                     |
| A click or tick is missing or faint                                    | The shot clicked outside `ctx.click`, or a new sound file lacks the 50 ms of leading silence: Revideo's mix drops about the first frame of every sound (`LEAD_IN` in sfx.tsx). Sounds are 16-bit WAV.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A recording starts mid-action                                          | A `Recording` plays from the moment it exists: create it when it is shown (`recordingBeat.run`, `SplitBeat.showRecording`), not up front.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| An open `<select>`, tooltip or OS dialog is missing from the recording | Screenshots don't contain native popups. Show the result of the choice, not the popup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Port 4420 in use                                                       | Another recording is running. One recording and one render at a time in `video/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## What gets committed

The sources under `video/`, video-lib changes and `releases/<v>.json`; `docs/assets/video/tour.mp4` with its poster only when the tour changed and the maintainer approved it. Never `video/out/`. ESLint ignores `video/`, so the commit hook doesn't format it: run `npm --prefix video run format` and `npm --prefix video run check` before committing.
