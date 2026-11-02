---
name: prism-motion-video
description: Use when making or changing an ng-prism product film - a release clip or the tour on the docs start page - with Claude Motion (the claude.ai "Motion" artifact type, MP4 export from its page), or when such a film needs ng-prism's title card, end card, captions, code cards, sound, narration, voice-over or sonic logo.
---

# Product films with Claude Motion

A Motion film is a private claude.ai artifact whose content lives in its store (`ArtifactData`), not in git: one JS
module per scene, lifted styleguide markup and CSS as modules, a score. The picture is the **real styleguide**: its DOM
and used CSS, lifted from a build, animated with a camera and a cursor. It is sharp at any zoom and reproduces the
product pixel for pixel. A narration goes on the exported MP4 afterwards.

There are two kinds of film, a **release clip** for every minor and the **tour** on the docs start page. They look and
sound the same: every film opens on the same title card, closes on the same end card and follows the house style below;
`templates/` holds all of it. Only this differs:

|                   | Release clip                                                     | Tour                                                                                |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Artifact          | a new one per release, titled "ng-prism <version>"               | one artifact, "ng-prism tour", changed in place (see _Changing the tour_)           |
| Title card        | `VERSION`: the minor, e.g. `22.8` (set in mono)                  | `VERSION`: the slogan "Your components, in full spectrum." (set in Inter)           |
| Beats             | the release's features, in the order of its release notes        | what ng-prism does, from annotating a component to its API page                     |
| End card          | `COMMAND`: `ng update @ng-prism/core`                            | `COMMAND`: `ng add @ng-prism/core`                                                  |
| Title's narration | "What's new in twenty-two point eight." (the minor spelled out)  | the slogan                                                                          |
| Delivered         | `.videos/ng-prism-<version>.mp4`, attached to the GitHub release | `.videos/ng-prism-tour.mp4`, copied to `docs/assets/video/tour.mp4` with its poster |
| Sources kept in   | `.videos/reference/<version>/`                                   | `.videos/reference/tour/`                                                           |

`.videos/` at the repo root is gitignored and belongs to the maintainer: the masters exported from Motion in
`.videos/originals-no-voice/`, the finished films (encoded, narrated) in `.videos/` itself, every film's sources in
`.videos/reference/`, the narration's cache in `.videos/narration-cache/`.

## Every film has this shape

| Scene                | Template                                 | Length   | Set per film                                       |
| -------------------- | ---------------------------------------- | -------- | -------------------------------------------------- |
| `title`              | `templates/scene-title.js`               | 4.0 s    | `VERSION` (table above)                            |
| one beat per feature | `scene-code-card.js` or `scene-click.js` | 5.5–8 s  | everything: the templates are worked examples      |
| `end`                | `templates/scene-end.js`                 | 4.0 s    | `COMMAND` (table above)                            |
| sound                | `templates/score.js`                     | the film | `CLICKS` only, each as a scene id and a time in it |
| narration            | `scripts/narrate.mjs`                    | the film | the beats' lines; the rest is fixed (step 12)      |

A click beat takes 5.5–7 s, a code card 7.5–8 s. `templates/base.css` and `templates/shared.js` go in unchanged,
`templates/scenes.example.json` is the shape of `modules/scenes.json` (its `fonts`, `palettes` and `theirs` stay as they
are; each scene's `id`, `name`, `dur` and `desc` are the film's), and the asset `symbol.png` is
`docs/logo_only_big.png`. Never change the title, the end card, the sound or the sonic logo unasked.

## House style (the maintainer's decisions)

- **Palette and type:** ground `#080d19`, the brand gradient cyan `#00cfea` → `#078bfa` → `#244bff` → violet `#a20cf0`,
  text `#f1f5f9`; Inter for words, JetBrains Mono for code. 1920×1080; the master has 60 fps, the web encode 30.
- **The window:** the lifted styleguide at 1440×900, placed at (240, 90) on the ground with its three soft glows.
- **Captions:** one line, at most ~45 characters not counting the `**` markers, a full stop, one `**…**` part in the
  brand gradient that closes the line, full stop included; lower third on a scrim, in at 0.15 s. One developer showing
  another: no superlatives, no emojis.
- **Pace:** the window, a code card and the caption come in during the first 0.5 s, and the camera may start its push;
  the cursor shows from ~1.0 s, typing and clicks start at ~1.4 s or later, so the caption is read first. Every effect
  holds 1.2 s or longer. One camera push in per beat, zoom 1.25–2.3; easing back out to show a result is fine. When the
  camera frames the bottom panel, put the window's bottom edge at stage y ≈ 756.
- **A click** is a cursor (`kit.cursor`, keys through `UI.at`) and a 0.2 s cross-fade from the lifted before state to
  the after state. A popover scales in from 0.96 at its anchor. At most one highlight per beat (`.hi`).
- **Code cards** (new `@Showcase` API): a card on the left over a veil, the file name on top, a contiguous slice of the
  file's lines **verbatim**, one line typed at 34 cps with a caret, the rest already there; the typed line must fit
  inside the card. Dropping the indentation all shown lines share is fine and is said to the maintainer; a long line
  runs out of the card under the fade, never wrapped or shortened. video-lib's showcases are written to fit a card;
  test-lib works where its lines do.
- **Terminal cards** (a feature without UI of its own: rescans, builder output, warnings, migrations): the code card's
  card and veil with a terminal in it. The command is typed at 34 cps, then the builder's real output appears
  **verbatim**, line by line at the pace it really comes. Behind the card the window cross-fades to its after state at
  the moment the output says the work is done, so cause and effect are both in the picture. No template yet: the first
  film that needs one builds it from `scene-code-card.js` and adds it to `templates/`. A feature with nothing to show,
  not even in the terminal, gets no beat; the release notes have it.
- **Sound:** no music. In the film only keystrokes (automatic from `kit.typist`) and the cursor's clicks (`CLICKS`).
- **Narration:** it opens with the sonic logo, `templates/sonic-logo.flac` (the ElevenLabs voice Lily whispering "N G
  prism" in a hall), 0.5 s into the title. Everything after it is the ElevenLabs voice Chris, an advertising read: the
  title's own line, one line per beat, and on the end card just "Try it out!". The end card shows the logo without
  speaking it.
- **Rejected, don't bring back:** mark pieces flying in, a light beam with a spectrum fan, twinkling stars, a ray burst,
  a second shine on the title (one sheen through prism and name, like the end card), music of any kind, the macOS system
  voices.

## Making a film

`scripts/` and `templates/` are in this skill's folder; `.videos/` and `test-workspace/` are at the repo root. For a
change to the tour, read _Changing the tour_ first.

1. **The source must exist.** A beat for new `@Showcase` API quotes a real showcase. If no showcase uses the option yet,
   add one to video-lib (that is a repo change: ask before committing it).
2. **Build:** `npm run build:all` at the repo root, then in `test-workspace` `CI=1 npx ng run test-lib:prism-build`
   (most beats) and `CI=1 npx ng run video-lib:prism-build` (code cards whose lines need video-lib's short showcases).
   Not `npm run test:workspace:update`: it kills whatever holds `:4400`. `:4400` and `:4401` are the maintainer's: check
   with `lsof` and leave them alone.
3. **Serve** each build statically: `python3 -m http.server 4430 --bind 127.0.0.1` in
   `test-workspace/dist/test-lib-prism`, port 4431 in `test-workspace/dist/video-lib-prism`.
4. **Lift** each state the film shows: write a config like `templates/lift-config.example.json` (`cssName` `ui-test.css`
   for test-lib, `ui-video.css` for video-lib: `shared.js` loads those names), run
   `node scripts/lift.mjs <config> <out>`, one out dir per build. A click needs a before and an after state. For a code
   card, lift the states as they are after the typed line exists, and keep what that line adds at opacity 0 until it is
   typed (the template does this with `prism-head-parts` in the first state). After a click, blur the focus (`eval`
   step); a menu needs both clicks; a transition a longer `wait`.
5. **Check the lift:** `node scripts/verify-lift.mjs <out> <css> <state…>` and read every `cmp-*.png` (real left, lift
   right). Fix the lift until they match.
6. **Package:** `node scripts/package-modules.mjs <out> <mods> <css> [ngv]`; video-lib gets the scope `ngv`.
7. **Write the scenes** from the templates. A scene's class names begin with its id. Retiming a beat means every time in
   it: the constants, and the literals in `render`, the cursor keys and visibility and the camera keys' `hold`.
8. **Preview every new or changed scene before it goes in.** The player can't be watched from here:
   `node scripts/preview.mjs <scene.js> <prefix> <t1,t2,…> --mods <mods> [--mods <mods2>] --dur <s>` renders it in a
   stand-in with the player's camera, cursor and typist (no sound), and tiles the frames. No `PAGEERROR` may show; read
   the sheet and full frames at the key moments, and compare a title or an end card with the stills in `reference/`.
9. **Create the film:** find the Motion type (`Artifact` quickstart, or `list` with `scope: "types"`), publish with its
   `type_url`, then follow the instructions the create result carries. Upload `symbol.png` as an asset and write its
   `assets/symbol.png` document (`mime` `image/png`); `base.css`, `shared.js` and the packaged modules go in as modules
   (`ArtifactData` batch with `file_path`), each scene as one `set` (`modules/scene-<id>.js`), then `modules/score.js`
   and `modules/scenes.json` with `"stage": "final"`. Every write to an existing document needs `if_version`. The store
   is the source: before changing a film later, read it back (`ArtifactData` `list` with `out_dir`).
10. **Hand it over:** the link, a word on any dropped indentation, and ask the maintainer to scrub it once: a scene that
    throws in the player shows only a card with its name. Export (MP4) is a button on the film's page, and only the
    maintainer can press it: ask for 1080p, 60 fps, High, Sharper text on. That file is the master, its size does not
    matter; the maintainer puts it into `.videos/originals-no-voice/`. A contact sheet of the master shows whether every
    scene rendered in the real player: `ffmpeg -i <master> -vf "fps=1/1.5,scale=400:-1,tile=6x6" -frames:v 1 sheet.png`.
11. **Encode for the web,** into a temporary file; narrating it comes next:

    ```bash
    ffmpeg -i <master> -filter_complex "[0:v]fps=30,split[a][b];\
    [b]trim=start=3.62,trim=end_frame=1,setpts=PTS-STARTPTS[p];[a]trim=start_frame=1,setpts=PTS-STARTPTS[r];\
    [p][r]concat=n=2:v=1:a=0[v]" -map "[v]" -map 0:a -c:v libx264 -preset slow -crf <crf> -tune animation \
      -profile:v high -pix_fmt yuv420p -c:a copy -movflags +faststart <encode>.mp4
    ```

    `<crf>` is 22 for a release clip and 20 for the tour. A release clip has to stay under 10 MB, GitHub's limit for a
    video on the free plan; CRF 22 turns a one-minute master of 47 MB into about 9 MB with the narration, CRF 20 into
    about 11 MB. Neither shows a visible loss (compare crops of code and small text against the master).

    The filter swaps the first frame for the title's lockup at 3.62 s. A player without a poster, on GitHub or Reddit,
    shows the first frame until someone presses play, and the film's own first frame is a blur of light. The swap keeps
    every other frame where it was, so the narration stays in sync; check that frame 0 shows the lockup and the frame
    count matches the plain encode.

12. **Narrate:**
    - **The lines:** the logo, the title's line, one line per beat written for a listener, the end card's. The
      maintainer approves the beats' lines before anything is generated. They go to
      `.videos/reference/<film>/narration.json` (`<film>` is the version or `tour`), a list of `{ at, until, text }`,
      like `.videos/reference/22.7/narration.json`.
    - **The timing:** `{ "at": 0.5, "logo": true }` first, then the title's line at 2.1 s (`"until": 4.0`); the end
      card's "Try it out!" 0.4 s after its cut. A beat's line starts 0.3–0.6 s after its cut and ends 0.2 s before the
      next line; `until` is the cut that ends its scene, which it may overrun by 0.6 s. At the default `--tempo 1.05`
      Chris speaks about 2.6 words a second. Spell what he would read wrongly as it should sound (`N G prism`,
      `J S Doc`).
    - **The run,** from the repo root: the first command measures every line against its window, the second lays them
      over the film.

        ```bash
        N=.agents/skills/prism-motion-video/scripts/narrate.mjs
        node $N <encode>.mp4 .videos/reference/<film>/narration.json --dry
        node $N <encode>.mp4 .videos/reference/<film>/narration.json .videos/ng-prism-<film>.mp4 --title "ng-prism <film>"
        ```

        It ducks the clicks under the voice, normalises to −16 LUFS, copies the picture and titles the MP4
        `ng-prism <film> · voice: elevenlabs.io`. Play the result to the maintainer
        (`open -a "QuickTime Player" .videos/ng-prism-<film>.mp4`) before it replaces anything.

    - **ElevenLabs:** the free plan, with `ELEVENLABS_API_KEY` in the shell (the maintainer's is in `~/.zshrc`). It
      can't use voices from ElevenLabs' library over the API, only the default voices, which is why the narrator is
      Chris. Every line is generated once and cached in `.videos/narration-cache/`: `--dry` already generates every line
      it measures, which is where the credits go, and the real run and a run after editing one line reuse what didn't
      change. The plan has 10,000 characters a month, a film's narration about 700. A line that sounds wrong gets a
      `"seed"` (any other number) for another take. The logo is not generated: `scripts/sonic-logo.mjs` rendered it
      once, from `templates/sonic-logo-take.mp3`.

13. **Deliver:**
    - **A release clip** stays in `.videos/ng-prism-<version>.mp4`. Check that it is under 10 MB. The maintainer drags
      it into the release notes in GitHub's web editor, which inserts a `github.com/user-attachments/assets/…` URL; a
      file under the release's assets would only be a download. The URL becomes a player only when it stands alone in
      its paragraph, so an empty line goes between it and the credit below; without it GitHub shows a plain link.
    - **The tour** is copied to `docs/assets/video/tour.mp4`, with a new poster from the master's lockup:
      `ffmpeg -ss 3.62 -i <master> -frames:v 1 docs/assets/video/tour-poster.png`.
    - **The credit:** the free plan's licence is non-commercial and wants "elevenlabs.io" in the title wherever a film
      is published. The release notes carry a line `Voice: elevenlabs.io` right below the clip; `docs/README.md` carries
      it below the tour's `<video>`.
    - **The sources** go to `.videos/reference/<film>/`, next to its `narration.json`: `scenes.json`, every scene and
      the score (read back from the store), the lift configs, and a still of every scene from `preview.mjs`, named
      `<scene id>.jpg`.

## Changing the tour

The tour is one artifact, "ng-prism tour", and a change goes into it:

1. Find it with `Artifact` `list` and read its store back (`ArtifactData` `list` with `out_dir`). If it is gone, rebuild
   it from `.videos/reference/tour/` first (see _Reference_).
2. Add, change or drop beats with steps 1–8; the title and the end card stay. Keep `scenes.json` in step with the
   scenes, and move the later narration lines when a beat's length changes.
3. Hand it over (step 10). From the new master on it is steps 11–13: all lines are narrated again (the unchanged ones
   come from the cache), and the docs get the new `tour.mp4` and poster.

## Reference

`reference/` in this skill holds stills of the title and the end card, rendered with `preview.mjs`. They are the same in
every film, except that a release's title shows its minor (here 22.7) and the tour's its slogan:

| Stills                                     | What they show                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `title-1-light.jpg` … `title-4-lockup.jpg` | the title at 0, 1.1, 2.95 and 3.62 s: inside the light, the flare, the one sheen, the lockup |
| `end-1-sheen.jpg`, `end-2-card.jpg`        | the end card with its sheen, and as it stands                                                |

Every finished film's sources are in `.videos/reference/<film>/` (step 13). A new release starts from the most recent
one: its scenes and stills show the house style at work. 22.7's, for instance, has a click (`scene-pages.js`), code
cards (`scene-compose.js`, `scene-parts.js`), a code card over the dark panel (`scene-a11y.js`) and a phone in a device
frame (`scene-mobile.js`). If a film's artifact is gone, it comes back from there: build the styleguides, lift and
package with its lift configs, create a new film and write its scenes and score, `base.css` and `shared.js` from
`templates/`, the packaged modules and the asset `symbol.png`. The lift shows the styleguide as it is at build time, so
a rebuilt film looks like today's styleguide, not like its stills.

## When something goes wrong

| Symptom                                                  | Cause and fix                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A lifted element has lost its background or gradient     | Chrome serialises `background: var(…)` followed by a longhand as empty longhands; `lift.mjs` re-reads such rules from the raw stylesheet.                                                                                                                                                                |
| A popover is missing or cut off in the lift              | It lived in the top layer. `lift.mjs` pins it `position: fixed` with a high `z-index` and `position-area: none`.                                                                                                                                                                                         |
| Every lifted state is ~400 KB                            | The header logo is a 180 KB data URI; the lift swaps it for `var(--ngp-logo)`, which `UI.stage` points at `symbol.png`.                                                                                                                                                                                  |
| Styles of the two builds overwrite each other            | Their `_ngcontent` ids and global rules differ: video-lib is scoped (`package-modules.mjs … ngv`).                                                                                                                                                                                                       |
| Something animated in the styleguide stands still        | CSS animations and transitions don't run in a film: drive it from `t` (the header's sheen and glow: `UI.light`).                                                                                                                                                                                         |
| Camera or cursor aim beside the element                  | Measure with `UI.box` in `init`, before the camera moves, against the state the element is in.                                                                                                                                                                                                           |
| A scene shows only its name card in the player           | It threw while loading. Run it through `preview.mjs` with the film's modules: page errors are printed.                                                                                                                                                                                                   |
| A gradient word shows the whole gradient in every letter | Split letters need `background-size` = word width and `background-position` = −`offsetLeft` (see the title).                                                                                                                                                                                             |
| A dark smear over a light canvas beside a code card      | The veil behind the card. Leave it out where the window behind the card is light, and frame the dark panel instead (22.7's `scene-a11y.js`).                                                                                                                                                             |
| A later state still shows an earlier one's inputs        | The styleguide keeps control values per component across navigation: click `Reset` and `goto` again before lifting the next beat.                                                                                                                                                                        |
| A `click` with `:text-is()` times out                    | The text sits in a child (`<span class="prism-tab__label">`): address the element by `aria-label` or class instead.                                                                                                                                                                                      |
| A phone-sized lift breaks the desktop windows            | Lift the phone at its size (`viewport` `{ width: 390, height: 844 }`, `touch: true` in the config), check it with `verify-lift.mjs … --size 390x844`, package it as `ui-phone.css` with the scope `ngm`, and show it in a device frame of the scene's own (22.7's `scene-mobile.js`, `lift-phone.json`). |
| `preview.mjs` times out launching Chromium               | The machine is under load; run it again.                                                                                                                                                                                                                                                                 |
| `narrate.mjs` gets 401 or `quota_exceeded`               | 401: the key is wrong or lacks the Text to Speech permission. `quota_exceeded`: the month's free characters are spent; cached lines still work, new ones wait for the reset.                                                                                                                             |
