---
name: prism-video
description: Use when making or changing an ng-prism product film - a release clip or the tour on the docs start page - with HyperFrames (HTML + GSAP rendered to MP4 on this machine), or when such a film needs ng-prism's light title, light end card, captions, code or terminal cards, interstitials, music, sound, narration, voice-over, sonic logo, or its YouTube version, thumbnail and subtitles.
---

# Product films with HyperFrames

A film is a [HyperFrames](https://github.com/heygen-com/hyperframes) project that this skill generates and renders on
this machine: one composition per scene, HTML and GSAP, with a WebGL shader for the light. The picture is the **real
styleguide**: its DOM and used CSS, lifted from a build, animated with a camera and a cursor, sharp at any zoom and
pixel for pixel the product. Each film is described in one file, `.videos/reference/<film>/film.mjs`; the scripts measure,
voice, build, render and deliver it. The films are public and meant to catch people: fancy is welcome, kitsch is not.

There are two kinds of film, a **release clip** for every minor and the **tour** on the docs start page. They look and
sound the same, open on the same light title and close on the same light end card. Only this differs:

|                    | Release clip                                                           | Tour                                                                        |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `<film>`           | the minor, e.g. `22.8`                                                 | `tour`                                                                      |
| `line` (title)     | the minor, `'22.8'` (set in mono)                                      | the slogan `'Your components, in **full spectrum.**'` (Inter)               |
| Beats              | the release's features, in the order of its release notes              | what ng-prism does, from annotating a component to its API page             |
| `command` (end)    | `ng update @ng-prism/core`                                             | `ng add @ng-prism/core`                                                     |
| Title's voice line | "What's new in twenty-two point eight." (`sub: "What's new in 22.8."`) | the slogan                                                                  |
| Delivered          | web version attached to the GitHub release (< 10 MB), YouTube version  | YouTube version; the web version also replaces `docs/assets/video/tour.mp4` |
| Sources in         | `.videos/reference/<version>/`                                         | `.videos/reference/tour/`                                                   |

`.videos/` at the repo root is gitignored and belongs to the maintainer:

- `.videos/reference/<film>/`: what rebuilds a film. `film.mjs`, the lift configs, `music/`, `credits.json`, a still
  per scene.
- `.videos/work/<film>/`: throwaway. Lift output, `coords.json`, the voice as WAV, the generated `project/`, the
  60 fps master, the contact sheet.
- `.videos/ng-prism-<film>.mp4`: the finished film, next to `-youtube.mp4`, `-youtube-thumbnail.png` and `.en.srt`.
- `.videos/narration-cache/`: every voice line ever generated. `.videos/originals-no-voice/` holds the old Motion
  masters and is no longer written.

## Every film has this shape

| Scene                | Kind                        | Length   | Per film                                        |
| -------------------- | --------------------------- | -------- | ----------------------------------------------- |
| title                | `title`                     | 5.6 s    | `line` (table above) and the title's voice line |
| one beat per feature | `app`, `code`, `tourCode`   | 5.5–10 s | everything                                      |
| 1–2 interstitials    | `slash`, `split`, `kinetic` | 1.5–3 s  | text and objects; no voice line                 |
| end                  | `end`                       | 5.5 s    | `command` (table above); voice "Try it out!"    |
| music, sound effects | `film.music`, automatic     | the film | the track and where it comes in                 |

Never change the title, the end card, the light or the sonic logo unasked; a film only sets their text.

## House style (the maintainer's decisions)

- **Palette and type:** ground `#080d19`, the brand gradient cyan `#00cfea` → `#078bfa` → `#244bff` → violet `#a20cf0`,
  text `#f1f5f9`; Inter for words, JetBrains Mono for code (both local: `assets/fonts/`, OFL). 1920×1080; the master
  has 60 fps, the web version 30.
- **Light:** the title and the end card are real light from a shader: a white beam with dust in it hits the prism, the
  prism draws itself in light edges and fills, the spectrum fans out with filaments, gathers into a band and sets the
  name alight letter by letter; one sheen through prism and name. The end card runs it the other way. Beam and
  spectrum come from the shader, never from flat CSS gradients. Stills: `reference/`.
- **The window:** the lifted styleguide at 1440×900, placed at (240, 90), radius 12 px, soft shadow and hairline.
- **Captions:** one line, at most ~45 characters not counting the `**` markers, a full stop, one `**…**` part in the
  brand gradient that closes the line, full stop included. Lower third on a scrim, word by word with a blur, in at
  0.3 s. One developer showing another: no superlatives, no emojis.
- **Pace:** window, card and caption come in during the first 0.5 s; the cursor shows from ~1.0 s; typing and clicks
  start at ~1.4 s or later, so the caption is read first. Every effect holds 1.2 s or longer. One camera push in per
  beat, zoom 1.25–2.3; easing back out to show a result is fine. At most one highlight per beat. When the camera frames
  the bottom panel, put the window's bottom edge at stage y ≈ 756.
- **Framing:** a camera key `{ cx, cy, z }` shows the stage from `cx ± 960/z` and `cy ± 540/z`. Keep that inside the
  window (x 240–1680, y 90–990), or the ground shows at the edge; and keep the window's controls out of the caption's
  band, the bottom 200 px of the frame.
- **Transitions:** app beats whip: out 0.24 s to the left with blur, in 0.32 s from the right, a short whoosh. The
  styleguide's first appearance in an `app` beat builds from the top under a line of the spectrum (`scan: true`);
  behind a code card the window is simply there.
- **Clicks:** the cursor presses in (0.78), a ring in cyan and violet widens at the point, and the lifted before state
  cross-fades into the after state 0.04 s later. The cursor lives in camera space, counter-scaled so it keeps its size.
- **Code cards** (new `@Showcase` API): the card on the left over a veil, the window behind it fading into the state the
  typed line makes, so cause and effect are both in the picture (22.7's compose and a11y beats). No veil where the window
  behind is light. A code beat may open already pushed in on the window (22.7's opens at zoom 1.5) and push once more. The file name on top, a contiguous slice of the file's lines **verbatim**, one line typed at 34 cps
  with a glowing caret, the rest already there. Dropping the indentation all lines share is fine and is said to the
  maintainer; a line too long for the card runs out under a fade on the right, never wrapped or shortened. video-lib's showcases are
  written to fit a card. The tour's opening card (`tourCode`, a 3D card in the middle typing a whole block) is the
  tour's alone.
- **Terminal cards** (a feature without UI: rescans, builder output, warnings, migrations): the code card's card and
  veil with a terminal in it; the command typed at 34 cps, the builder's real output **verbatim** at the pace it really
  comes, the window behind cross-fading when the output says the work is done. No pattern yet: the first film that
  needs one adds it to `scripts/lib/beats.mjs`, built from `code`. A feature with nothing to show gets no beat.
- **Interstitials:** 1–2 per film, 1.5–3 s, between two beats whose content they bridge, without a voice line. Claude
  proposes them and their place with the beats; the maintainer approves them with the voice lines. A `kinetic` line
  holds about 20 characters on one line. New patterns in the same light and
  brand look are welcome (`scripts/lib/interstitials.mjs`).
- **Sound:** CC0 music under the voice (step 9), ducked while it speaks; sound effects from HyperFrames' library
  (clicks, keys, whooshes, bass impacts) come with the beats.
- **Narration:** it opens with the sonic logo, `templates/sonic-logo.flac` (the ElevenLabs voice Lily whispering "N G
  prism" in a hall), 0.45 s into the title, added automatically. Everything after it is the ElevenLabs voice Chris, an
  advertising read: the title's line, one line per beat, "Try it out!" on the end card, which never speaks the logo.
- **Never:** twinkling stars, ray bursts, the macOS system voices. Effects without a link to light, spectrum or the
  product, and effects that push the feature out of the picture, are kitsch too.

## HyperFrames, privately

- Run HyperFrames **only** through `node .agents/skills/prism-video/scripts/hf.mjs <command>`: it switches telemetry,
  update checks and auto and optional installs off, keeps the keys of outside services (HeyGen, Gemini, ElevenLabs, …)
  out of its environment and refuses everything that uploads, signs in or reads credentials. Never run
  `hyperframes usage` (it reads Claude Code's credentials), `publish`, `cloud`, `lambda`, `auth`, `audio` (its best
  quality uploads the sound to HeyGen), nor `snapshot --describe` (it sends frames to Gemini). No HeyGen account is
  needed.
- HyperFrames is a root devDependency, pinned exactly like Playwright. Chrome for it comes once:
  `node .agents/skills/prism-video/scripts/hf.mjs browser ensure`. `hf.mjs doctor` reports `ok: false` without Docker,
  whisper, Kokoro and MusicGen, which no film needs; Node, FFmpeg, FFprobe and Chrome must be ok.
- What HyperFrames itself knows (timeline rules, `data-*` attributes, lint and check codes, audio, captions) is in the
  package: `node_modules/hyperframes/dist/skills/hyperframes/SKILL.md` and its `references/`, `hyperframes-cli/` and
  `media-use/`. Read them before writing a new pattern; don't install HyperFrames' own skills or plugin.

## Making a film

`scripts/` and `templates/` are in this skill's folder; `.videos/` and `test-workspace/` are at the repo root. Run
everything from the repo root (`S=.agents/skills/prism-video/scripts`). For a change to the tour, read _Changing the
tour_ first.

1. **The source must exist.** A beat for new `@Showcase` API quotes a real showcase. If no showcase uses the option yet,
   add one to video-lib (that is a repo change: ask before committing it).
2. **Build:** `npm run build:all`, then in `test-workspace` `CI=1 npx ng run test-lib:prism-build` (most beats) and
   `CI=1 npx ng run video-lib:prism-build` (code cards whose lines need video-lib's short showcases). Not
   `npm run test:workspace:update`: it kills whatever holds `:4400`. `:4400` and `:4401` are the maintainer's: check
   with `lsof` and leave them alone.
3. **Serve** each build statically: `python3 -m http.server 4430 --bind 127.0.0.1` in
   `test-workspace/dist/test-lib-prism`, port 4431 in `test-workspace/dist/video-lib-prism`.
4. **Lift** each state the film shows: a config like `templates/lift-config.example.json` per build in
   `.videos/reference/<film>/`, named `lift-test-lib.json` and `lift-video-lib.json` (`cssName` `ui-test.css` and
   `ui-video.css`), then
   `node $S/lift.mjs <config> .videos/work/<film>/lift/<build>`, where `<build>` is the key the film gives it in
   `builds` (`test`, `video`). A click needs a before and an after state; marks put `data-v` hooks on what the camera
   and cursor aim at. For a code card, lift the state with what the typed line makes and mark the new part (`as`):
   the styleguide always shows the component, so the card's before state is that same state with the part hidden
   (`hide`, step 6).
   After a click, blur the focus (`eval` step); a menu needs both clicks; a transition a longer `wait`.
5. **Check the lift:** `node $S/verify-lift.mjs .videos/work/<film>/lift/<build> <css> <state…>` and read every
   `cmp-*.png` (real left, lift right). Fix the lift until they match.
6. **Describe the film** in `.videos/reference/<film>/film.mjs`, starting from `templates/film.example.mjs` (the tour,
   worked through). It exports `{ kind: 'release' | 'tour', line, command, builds, marks, music, scenes(ctx) }`:
    - `builds`: `{ video: { scope: 'ngv', css: 'ui-video.css' }, test: { scope: 'ngp', css: 'ui-test.css' } }`, only
      the ones the film uses; the scope keeps the two builds' styles apart.
    - `music`: `{ file, from }` (step 9), or `null` for none.
    - `marks`: `{ 'build/state': { name: selector } }`, everything camera, cursor and highlights aim at.
    - `scenes({ box, mid })` returns the scenes in order. `box('state.name')` is a measured mark in stage space,
      `mid(box, dx, dy)` its centre; times inside a scene are scene time. Every scene has `id`, `kind`, `dur` and
      optionally `vo: { at, text, seed?, sub? }` (any scene may go without; a finished film voices title, beats and
      end):

    | `kind`     | Fields                                                                                                                                                                                                                                                                                                                                                  |
    | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `title`    | `dur: 5.6`, the title's voice line at 2.9 s                                                                                                                                                                                                                                                                                                             |
    | `end`      | `dur: 5.5`, `vo: { at: 1.55, text: 'Try it out!' }`                                                                                                                                                                                                                                                                                                     |
    | `app`      | `wins: [['build/state', alt?]…]` (a window per state; `alt` is HTML or a function that changes the lifted HTML), `cap`, `cam: [{ t, cx, cy, z, hold?, drift? }]`, `cur: [{ t, x, y }]`, `vis: [in0, in1, out0?, out1?]`, `clicks`, `fades: [{ win, at }]`, `his: [{ name, box, at }]`, `scan`, `light: [t0, t1]` (the header's sheen), `extra(tl, sfx)` |
    | `code`     | `file`, `src` (lines, verbatim), `typedLine`, `t0`, `cap`, `win: { states: [before, after], hide?, after?, cam? }` (each state a ref or `[ref, alt]`; `hide`: selectors hidden in the before window; the window fades at `after`, by default 0.1 s after the line is typed), `veil`, `width` (832; 700 for a narrow card)                               |
    | `tourCode` | `file`, `src`, `typed` (lines), `t0`, `seconds`, `cap`                                                                                                                                                                                                                                                                                                  |
    | `slash`    | `chip` (a file name), `head` (`'No **story files.**'`)                                                                                                                                                                                                                                                                                                  |
    | `split`    | `outs: [[label, css]…]` (real values from the lifted CSS), `cap`, `label`                                                                                                                                                                                                                                                                               |
    | `kinetic`  | `text` (`'Fast. **Really fast.**'`)                                                                                                                                                                                                                                                                                                                     |

    A code beat in the 22.7 composition, with the field marked `field` in the lift of state `field` (22.7's camera
    numbers; check them against _Framing_ for each film):

    ```js
    const f = box('field.field');
    const at = (z) => ({ cx: f.x + f.w / 2 - 430 / z, cy: f.y + f.h / 2 + 70 / z, z });
    ({
        id: 'compose',
        kind: 'code',
        dur: 8,
        vo: { at: 0.4, text: '…' },
        file: 'field.component.ts',
        src: FIELD,
        typedLine: 7,
        t0: 1.4,
        cap: 'Compose real templates. **Compiled, not mocked.**',
        win: {
            states: ['video/field', 'video/field'],
            hide: ['[data-v=field]'],
            cam: [
                { t: 0, ...at(1.5), hold: 3.6 },
                { t: 4.8, ...at(2.3), drift: [0, 0, 0.01] }
            ]
        }
    });
    ```

    A new beat is a description plus a few lines of arithmetic on `box`, not a new generator. A new pattern goes into
    `scripts/lib/` with a test.

7. **Measure:** `node $S/measure.mjs <film>` writes `.videos/work/<film>/coords.json` and a screenshot per state in
   `measure/`. A state that was not lifted or a mark that matches nothing stops it, naming both.
8. **Voice:** write each line for a listener: the title's line, one per beat (starting 0.35–0.8 s into it), "Try it
   out!". **The maintainer approves the lines and the interstitials before anything is generated.** Spell what Chris
   would read wrongly as it should sound (`N G prism`, `J S Doc`); a release's spelled-out version gets a `sub` for the
   subtitles. `node $S/narrate.mjs <film> --dry` calls no API: it measures the lines already cached, estimates the
   others (and names them) and says how many characters a real run would spend. `node $S/narrate.mjs <film>` generates what is missing (needs
   `ELEVENLABS_API_KEY`), writes the WAVs and `voice.json`, and stops if a line runs past its scene or into the next.
   Chris speaks about 2.6 words a second at the tempo of 1.05.
9. **Music:** `node $S/music.mjs search <words…>` lists CC0 tracks from Openverse (Freesound and others), nothing
   else. Pick by tags, length and energy, suggest one, and let the maintainer listen (its page link) and confirm track
   and licence. Then `node $S/music.mjs get <film> <id>` downloads it to `music/` and records it in `credits.json`.
   Set `music: { file, from }` in `film.mjs`: the track comes in at 0.58 s so that its `from` second lands on the
   title's impact at 0.6 s. After a build, `node $S/hf.mjs beats .videos/work/<film>/project` writes
   `beats/<track>.json` in the project; choose `from` on a strong beat. CC0 needs no credit line anywhere.
10. **Build:** `node $S/build.mjs <film>` measures the name for title and end card and generates
    `.videos/work/<film>/project/`. It stops on a lift that would load anything from the network.
11. **Check,** in `.videos/work/<film>/project/`: `node ../../../../$S/hf.mjs lint` (0 errors) and
    `… hf.mjs check --json` (`"ok": true`; expected are the warnings `negative_z_index` from the lifted CSS,
    `dead_stretch` in app and code beats, `line_unread` or `text_below_floor` in interstitials and the tour's card).
    Then `… hf.mjs snapshot --at <times> --no-end -o ../snap` at every scene's key moments and read every contact sheet
    and the frames that matter at full size. A moment's film time is the scene's start (`build.mjs` prints them) plus
    its time in the scene from `film.mjs`: after a click, a camera key's arrival, a code card's `t0 + typed / 34`, the
    title's lockup at 3.4 s. Compare title and end card with `reference/`.
12. **Show it before rendering:** `… hf.mjs preview --port 4432` opens HyperFrames' Studio on localhost, where the
    maintainer can scrub the film with sound. Fix what they find from step 6 on.
13. **Render and deliver:** `node $S/deliver.mjs <film>` renders the 60 fps master (about 80 s for a minute on this
    machine's GPU), checks its length against the film, measures loudness (−16 LUFS ±1, true peak ≤ −1.5 dBFS, else
    a two-pass loudnorm in the encodes), and writes the web version (30 fps, x264, CRF 22 for a release, 20 for the
    tour, first frame swapped for the title's lockup at 3.4 s, so a player without a poster shows the name), the
    YouTube version (2560×1440, 60 fps, CRF 18), the thumbnail (1280×720 from the lockup), the subtitles and the
    contact sheet `.videos/work/<film>/sheet.jpg`. It also measures every frame of the master and names any frame
    where the light drops out or flashes up for a moment; look at those frames. Read the sheet: a scene with missing
    light or a black frame shows there. It overwrites nothing without `--force`; `--skip-render` encodes the existing master again. Every MP4 is
    titled `ng-prism <film> · voice: elevenlabs.io`. Play the film to the maintainer
    (`open -a "QuickTime Player" .videos/ng-prism-<film>.mp4`) before it goes anywhere.
14. **Publish:**
    - **A release clip:** the maintainer drags the web version into the release notes in GitHub's web editor (a
      `github.com/user-attachments/assets/…` URL becomes a player only alone in its paragraph: an empty line between it
      and the credit). It must stay under 10 MB; `deliver.mjs` stops when it does not.
    - **The tour,** after the maintainer's OK: `node $S/deliver.mjs tour --docs --force` copies it to
      `docs/assets/video/tour.mp4` with a new `tour-poster.jpg`. Those two files are the only film files in git.
    - **YouTube:** the `-youtube.mp4`, its thumbnail and the `.en.srt` (the voice lines as spoken, `N G prism` and
      `J S Doc` written properly, the sonic logo as "ng-prism").
    - **The voice credit:** ElevenLabs' free plan is non-commercial and wants "elevenlabs.io" wherever a film is
      published: the MP4 title, a `Voice: elevenlabs.io` line right below the clip in the release notes, below the
      tour's `<video>` in `docs/README.md`, and in the YouTube description.
    - **The sources:** a still of every scene at its main moment goes to `.videos/reference/<film>/<scene id>.jpg`
      (960×540, from the snapshots).

## Changing the tour

Everything is in `.videos/reference/tour/`. Change `film.mjs` (beats, lines, interstitials; title and end card stay),
lift what is new or changed with its configs, and run from step 7 on. Unchanged lines come from the cache; a beat that
gets longer moves the later scenes by itself. After the maintainer's OK the docs get the new film and poster (step 14).

## Reference

`reference/` holds stills of the light title and end card, 960×540. They are the same in every film, except that a
release's title shows its minor and the tour's its slogan:

| Stills                                                   | What they show                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `title-1-beam.jpg`, `title-2-fan.jpg`                    | 0.62 s: the beam hits the prism; 1.4 s: the spectrum fans out           |
| `title-3-ignite.jpg`, `title-4-lockup.jpg`               | 2.3 s: the band sets the name alight; 3.4 s: the lockup (poster, thumb) |
| `end-1-inflow.jpg`, `end-2-ignite.jpg`, `end-3-card.jpg` | 0.45 s: the spectrum flows in; 1.2 s: white light out; 5.2 s: the card  |

`templates/film.example.mjs` is the tour as a worked example: every kind of beat but `code`, both interstitial
patterns it uses, marks, music. Every film's sources are in `.videos/reference/<film>/`; the 22.7 clip and the tour
before 2026-11 were made with Claude Motion (`.videos/reference/22.7/`, `tour-motion/`), and their scenes still show
the house style at work, including a phone in a device frame (22.7's `scene-mobile.js`, `lift-phone.json`), which the
first film that needs it brings into `scripts/lib/`.

## When something goes wrong

| Symptom                                                  | Cause and fix                                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A lifted element has lost its background or gradient     | Chrome serialises `background: var(…)` followed by a longhand as empty longhands; `lift.mjs` re-reads such rules from the raw stylesheet.                                                                          |
| A popover is missing or cut off in the lift              | It lived in the top layer. `lift.mjs` pins it `position: fixed` with a high `z-index` and `position-area: none`.                                                                                                   |
| A popover sits in the wrong place in the film            | Top-layer popovers are `position: fixed`; `.ngp { contain: layout paint }` makes the window their reference.                                                                                                       |
| `lift.mjs` prints ~400 KB per state                      | That is the page before pruning; the header logo alone is a 180 KB data URI, which the lift swaps for `var(--ngp-logo)`. `<state>.html` is what the film uses, `<state>.raw.html` the unpruned copy for debugging. |
| A later state still shows an earlier one's inputs        | The styleguide keeps control values per component across navigation: click `Reset` and `goto` again before lifting the next beat.                                                                                  |
| A `click` with `:text-is()` times out                    | The text sits in a child (`<span class="prism-tab__label">`): address the element by `aria-label` or class instead.                                                                                                |
| `check` fails on fonts                                   | The CSS names a family that doesn't come along. The film's fonts are `Inter Prism` and `JBM Prism` (`--sans`, `--mono` on the window), loaded from `assets/fonts/`.                                                |
| `css_transition_used` in `lint`                          | Transitions and animations run on the browser's clock: the build strips them from the lifted CSS. Something that should move is driven from the timeline (the header's sheen: `light`).                            |
| Duplicate ids, broken SVG references                     | Several windows per page: the build prefixes ids per window, `url(#…)` and `href="#…"` with them. An id you add in `alt` is yours to keep unique.                                                                  |
| An element shows too early                               | A `fromTo` renders its start value at once: later tweens on the same property need `immediateRender: false`.                                                                                                       |
| Camera or cursor aim beside the element                  | The mark was measured in another state: give it to the state the element is in, and measure again.                                                                                                                 |
| Monospace widths or the name's letters are off           | A page under `about:blank` loads no `file://` fonts: measuring pages are files (`measure.mjs`, `build.mjs` do this).                                                                                               |
| `dead_stretch` in app beats                              | Windows carry `data-layout-ignore`, so `check` doesn't see them move: the snapshots decide.                                                                                                                        |
| `text_occluded` on the name                              | The sheen is a layer over the name on purpose: both carry `data-layout-allow-occlusion`. Anything else covering text is a real finding.                                                                            |
| The cursor sits at (0, 0)                                | A scene without a cursor: it stays hidden unless `cur` is set.                                                                                                                                                     |
| The light freezes or is missing in single frames         | The shader was drawn from outside the scene's time: it may only draw in the `onUpdate` of the tween over the whole scene (`lib/light.mjs`).                                                                        |
| A gradient word shows the whole gradient in every letter | Split letters need `background-size` = word width and `background-position` = −the letter's left edge (the title does this from the measured name).                                                                |
| A dark band over a light canvas under the caption        | The caption's scrim. Frame the light part above the bottom 200 px of the frame.                                                                                                                                    |
| A dark smear over a light canvas beside a code card      | The veil behind the card: `veil: false` where the window behind is light, and frame the dark panel instead.                                                                                                        |
| The build stops: "would load from the network"           | The lift or a pattern references a remote file (`url(https://…)`, `@import`, `src`): make it local.                                                                                                                |
| `narrate.mjs` stops: a line runs past its scene          | Shorten the line, start it earlier, or lengthen the scene; the message names scene and overhang.                                                                                                                   |
| `narrate.mjs` gets 401 or `quota_exceeded`               | 401: the key is wrong or lacks the Text to Speech permission. `quota_exceeded`: the month's 10,000 free characters are spent; cached lines still work, new ones wait for the reset.                                |
| `music.mjs` hangs or gets HTML                           | Openverse throttles anonymous clients; the script waits and retries. Try again a minute later.                                                                                                                     |
| A phone-sized lift breaks the desktop windows            | Lift the phone at its size (`viewport` `{ width: 390, height: 844 }`, `touch: true`), check it with `verify-lift.mjs … --size 390x844`, give it its own build and scope (`ngm`) and a device frame of its own.     |
