// A worked example: the ng-prism tour (.videos/reference/tour/film.mjs). A new film starts from a copy of this file in
// .videos/reference/<film>/film.mjs; SKILL.md, step 6, lists every kind of scene and its fields.

// test-workspace/projects/video-lib/src/lib/button/button.component.ts, the @Showcase block and the class, verbatim
const BUTTON = [
    '@Showcase({',
    "    title: 'Button',",
    "    category: 'Inputs',",
    '    variants: [',
    "        { name: 'Primary', inputs: { label: 'Save' } },",
    "        { name: 'Ghost', inputs: { label: 'Save', variant: 'ghost' } }",
    '    ],',
    '    states: [',
    "        { name: 'Hover', pseudo: { hover: '.btn' } },",
    "        { name: 'Focus visible', pseudo: { 'focus-visible': '.btn' } },",
    "        { name: 'Pressed', pseudo: { hover: '.btn', active: '.btn' } }",
    '    ]',
    '})',
    '@Component({',
    "    selector: 'ui-button',",
    "    templateUrl: './button.component.html',",
    "    styleUrl: './button.component.css'",
    '})',
    'export class ButtonComponent {',
    "    readonly label = input('Button');",
    "    readonly variant = input<'primary' | 'ghost'>('primary');",
    '    readonly clicked = output<void>();',
    '}'
];

// the canvas button gets one span per typed prefix of the label; the control gets its value per key
const LABEL = 'Ship it';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const typedButton = (h) =>
    h
        .replace(
            /(<button[^>]*data-v="canvas-btn"[^>]*>)Save(<\/button>)/,
            (_, a, z) =>
                a +
                '<span id="controls-p0">Save</span>' +
                [...LABEL].map((_, k) => `<span id="controls-p${k + 1}" style="display:none">${esc(LABEL.slice(0, k + 1))}</span>`).join('') +
                z
        )
        .replace(/(<input[^>]*data-v="label")/, '$1 id="controls-inp"');

export default {
    kind: 'tour',
    line: 'Your components, in **full spectrum.**',
    command: 'ng add @ng-prism/core',
    builds: { video: { scope: 'ngv', css: 'ui-video.css' }, test: { scope: 'ngp', css: 'ui-test.css' } },
    marks: {
        'video/btn': {
            btn: '[data-v=canvas-btn]',
            sb: '[data-v=sb-button]',
            label: '[data-v=label]',
            ghost: '[data-v=ctl-ghost]',
            tools: '[data-v=tools]',
            tabs: '.prism-tab[aria-label=Ghost]'
        },
        'video/ctl-clicked': { events: '[aria-controls=panel-events]' },
        'video/st-tools': { hover: '[data-v=chip-hover]', focus: '[data-v=chip-focus]', pressed: '[data-v=chip-pressed]', pop: '[data-popover-open]' },
        'video/st-box': { boxTab: '[data-v=box-tab]', margin: '.prism-bmp__region--margin' },
        'video/a11y-before': { tab: '[aria-controls=panel-a11y]' },
        'video/a11y-after': { card: 'prism-metric-card', badge: '.viol-list .prism-list-row__badge prism-badge' },
        'test/api-before': { seg: '[data-v=api-seg]' }
    },
    // "Circuit Synthwave" by Doctor_Dreamchip (Freesound 460357, CC0); 15.485 s is a beat that lands on the title's impact
    music: { file: 'circuit-synthwave.mp3', from: 15.485 },

    scenes({ box, mid }) {
        const P = (r, dx, dy, t) => ({ t, ...mid(r, dx, dy) });

        // reveal: the styleguide builds under a scan line, then the camera frames sidebar and button
        const reveal = (() => {
            const b = box('btn.btn'),
                s = box('btn.sb');
            const left = s.x,
                right = b.x + b.w + 120,
                z = 1920 / (right - left);
            return {
                cam: [
                    { t: 0, cx: 960, cy: 540, z: 1, hold: 1.1 },
                    { t: 2.6, cx: (left + right) / 2, cy: b.y + b.h / 2 - 60, z, drift: [3, 1, 0.008] }
                ]
            };
        })();

        // controls: type into a control, the button follows; switch to ghost; a click shows in Events
        const controls = (() => {
            const inp = box('btn.label'),
                pill = box('btn.ghost'),
                b = box('btn.btn'),
                ev = box('ctl-clicked.events');
            const z = 1.35,
                cy = b.y + b.h / 2 + (540 - 200) / z;
            const T = { focus: 1.9, type: 2.15, ghost: 4.4, press: 5.9, mark: 6.3 };
            const keyT = [...LABEL].map((_, k) => T.type + k / 8);
            const done = keyT[keyT.length - 1] + 1 / 8 + 0.15;
            return {
                cam: [
                    { t: 0, cx: 960, cy: 540, z: 1, hold: 0.4 },
                    { t: 1.5, cx: (inp.x + pill.x + pill.w) / 2, cy, z, drift: [0, 0, 0.004] }
                ],
                cur: [
                    P(inp, 260, 160, 0),
                    P(inp, 260, 160, 1.0),
                    P(inp, 30, 0, 1.8),
                    P(inp, 30, 0, 3.6),
                    P(pill, 0, 0, 4.3),
                    P(pill, 0, 0, 4.8),
                    P(b, 0, 0, 5.8),
                    P(b, 120, 80, 6.6)
                ],
                clicks: [
                    { t: T.focus, ...mid(inp, 30) },
                    { t: T.ghost, ...mid(pill) },
                    { t: T.press, ...mid(b) }
                ],
                fades: [
                    { win: 1, at: done - 0.04 },
                    { win: 2, at: T.ghost },
                    { win: 3, at: T.press }
                ],
                his: [{ name: 'hi', box: { x: ev.x - 4, y: ev.y + 2, w: ev.w + 8, h: ev.h - 4 }, at: T.mark }],
                extra: (tl, sfx) =>
                    keyT.forEach((t, k) => {
                        tl.set('#controls-inp', { attr: { value: LABEL.slice(0, k + 1) } }, t);
                        tl.set(`#controls-p${k}`, { display: 'none' }, t);
                        tl.set(`#controls-p${k + 1}`, { display: 'inline' }, t);
                        sfx('key-press', t, 0.35);
                    })
            };
        })();

        // states: canvas tools, Hover / Focus visible / Pressed, then the Box Model overlay
        const states = (() => {
            const b = box('btn.btn'),
                tools = box('btn.tools'),
                pop = box('st-tools.pop'),
                boxTab = box('st-box.boxTab'),
                d = box('st-box.margin');
            const hover = box('st-tools.hover'),
                focus = box('st-tools.focus'),
                pressed = box('st-tools.pressed');
            const T = { tools: 1.7, hover: 2.6, focus: 3.5, pressed: 4.4, box: 5.9, onBtn: 6.6 };
            const left = b.x - 260,
                right = tools.x + tools.w + 40,
                z = 1920 / (right - left);
            const x0 = Math.min(b.x, d.x) - 80,
                x1 = Math.max(b.x + b.w, d.x + d.w) + 80,
                y0 = b.y - 60,
                y1 = Math.min(d.y + d.h, 990) + 30;
            const z2 = Math.min(1920 / (x1 - x0), 700 / (y1 - y0));
            return {
                cam: [
                    { t: 0, cx: 960, cy: 540, z: 1, hold: 0.4 },
                    { t: 1.5, cx: (left + right) / 2, cy: (pop.y + b.y + b.h) / 2 + 40, z, hold: 3.5 },
                    { t: 5.7, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + (160 / z2) * 0.5, z: z2, drift: [0, 0, 0.004] }
                ],
                cur: [
                    P(b, 120, 90, 0),
                    P(b, 120, 90, 1.0),
                    P(tools, 0, 0, 1.6),
                    P(tools, 0, 0, 1.9),
                    P(hover, 0, 0, 2.5),
                    P(focus, 0, 0, 3.4),
                    P(pressed, 0, 0, 4.3),
                    P(pressed, 0, 0, 4.8),
                    P(boxTab, 0, 0, 5.8),
                    P(boxTab, 0, 0, 6.1),
                    P(b, 10, 6, T.onBtn)
                ],
                clicks: [
                    { t: T.tools, ...mid(tools) },
                    { t: T.hover, ...mid(hover) },
                    { t: T.focus, ...mid(focus) },
                    { t: T.pressed, ...mid(pressed) },
                    { t: T.box, ...mid(boxTab) }
                ],
                fades: ['tools', 'hover', 'focus', 'pressed', 'box'].map((k, i) => ({ win: i + 1, at: T[k] })),
                extra: (tl) => {
                    // the canvas tools' popover scales in from its anchor; the margin box shows when the cursor is on the button
                    tl.raw("gsap.set('#states-w1-prism-tools', { transformOrigin: '100% 0' });");
                    tl.ft('#states-w1-prism-tools', { scale: 0.96 }, { scale: 1, duration: 0.2, ease: 'power2.out' }, T.tools + 0.04);
                    tl.ft('#states-bm', { opacity: 0 }, { opacity: 1, duration: 0.2 }, T.onBtn - 0.05);
                }
            };
        })();

        // a11y: the faint Ghost variant, the A11y tab, its real contrast violation
        const a11y = (() => {
            const tab = box('a11y-before.tab'),
                card = box('a11y-after.card'),
                bd = box('a11y-after.badge');
            return {
                cam: [
                    { t: 0, cx: 960, cy: 540, z: 1, hold: 0.4 },
                    { t: 1.5, cx: 960, cy: 990 - 216 / 1.25, z: 1.25, hold: 1.4 },
                    { t: 3.7, cx: card.x + 840 / 1.6, cy: 990 - 216 / 1.6, z: 1.6, drift: [2, 0, 0.005] }
                ],
                cur: [P(tab, 240, -160, 0), P(tab, 240, -160, 1.0), P(tab, 0, 0, 1.9), P(tab, 0, 0, 2.4), P(tab, 90, 140, 3.2)],
                clicks: [{ t: 2.1, ...mid(tab) }],
                fades: [{ win: 1, at: 2.1 }],
                his: [{ name: 'hi', box: { x: bd.x - 3, y: bd.y - 5, w: bd.w + 6, h: bd.h + 10 }, at: 3.9 }]
            };
        })();

        // api: a click on API opens the page generated from the Form Field's JSDoc
        const seg = box('api-before.seg');

        return [
            { id: 'title', kind: 'title', dur: 5.6, vo: { at: 2.9, text: 'Your components, in full spectrum.' } },
            {
                id: 'annotate',
                kind: 'tourCode',
                dur: 10,
                vo: { at: 0.8, text: 'Instead of writing stories, you describe a component where it lives: one Showcase decorator, with its variants and its states.' },
                file: 'button.component.ts',
                src: BUTTON,
                typed: 13,
                t0: 1.4,
                seconds: 4.5,
                cap: 'Annotate **the component itself.**'
            },
            { id: 'nostory', kind: 'slash', dur: 1.9, chip: 'button.stories.ts', head: 'No **story files.**' },
            {
                id: 'reveal',
                kind: 'app',
                dur: 5.6,
                vo: { at: 0.45, text: 'N G prism scans your library and builds the styleguide from it.' },
                wins: [['video/btn']],
                cap: "That's **the styleguide.**",
                ...reveal,
                light: [0.9, 3.2],
                scan: true
            },
            {
                id: 'controls',
                kind: 'app',
                dur: 8.6,
                vo: { at: 0.4, text: 'Every input gets a control. Change it, and the component follows live. Outputs show up as events.' },
                wins: [['video/btn', typedButton], ['video/ctl-label'], ['video/ctl-ghost'], ['video/ctl-clicked']],
                cap: 'Change inputs. **See it live.**',
                vis: [0.9, 1.2, 7.0, 7.3],
                ...controls
            },
            {
                id: 'split',
                kind: 'split',
                dur: 2.7,
                outs: [
                    ['Primary', 'background:#2563eb;color:#fff'],
                    ['Ghost', 'background:#0e1524;color:#3b4a6b;border-color:#26324a'],
                    ['Hover', 'background:#1d4ed8;color:#fff'],
                    ['Focus visible', 'background:#2563eb;color:#fff;outline:4px solid #60a5fa;outline-offset:5px'],
                    ['Pressed', 'background:#1e40af;color:#fff']
                ],
                cap: 'One component. **Every variant, every state.**'
            },
            {
                id: 'states',
                kind: 'app',
                dur: 8.6,
                vo: { at: 0.4, text: 'Switch hover, focus and pressed states on the canvas, and check the box model down to the pixel.' },
                wins: [
                    ['video/btn'],
                    ['video/st-tools'],
                    ['video/st-hover'],
                    ['video/st-focus'],
                    ['video/st-pressed'],
                    ['video/st-box', (h) => h.replace('class="prism-bm__box prism-bm__box--margin"', 'id="states-bm" class="prism-bm__box prism-bm__box--margin"')]
                ],
                cap: 'Every state. **Every pixel.**',
                vis: [0.9, 1.2],
                ...states
            },
            {
                id: 'a11y',
                kind: 'app',
                dur: 7,
                vo: { at: 0.4, text: 'Every variant gets an accessibility check, so a contrast problem shows up before your users find it.' },
                wins: [['video/a11y-before'], ['video/a11y-after']],
                cap: 'Every variant gets **an a11y check.**',
                vis: [0.9, 1.2, 3.2, 3.5],
                ...a11y
            },
            {
                id: 'api',
                kind: 'app',
                dur: 8,
                vo: { at: 0.35, text: 'Your J S Doc becomes the API page: description, usage and examples, without a separate docs file.' },
                wins: [['test/api-before'], ['test/api-after']],
                cap: 'API pages, **straight from your JSDoc.**',
                cam: [
                    { t: 0, cx: 960, cy: 540, z: 1, hold: 0.4 },
                    { t: 1.5, cx: 1680 - 480, cy: 90 + 270, z: 2, hold: 1.3 },
                    { t: 4.0, cx: 1100, cy: 180 + 540 / 1.4 - 10, z: 1.4, drift: [0, 3, 0.004] }
                ],
                cur: [P(seg, -260, 220, 0), P(seg, -260, 220, 1.0), P(seg, 0, 0, 2.0), P(seg, 0, 0, 2.5), P(seg, -120, 160, 3.2)],
                vis: [0.9, 1.2, 3.2, 3.5],
                clicks: [{ t: 2.2, ...mid(seg) }],
                fades: [{ win: 1, at: 2.2 }]
            },
            { id: 'end', kind: 'end', dur: 5.5, vo: { at: 1.55, text: "One command, and you're set." } }
        ];
    }
};
