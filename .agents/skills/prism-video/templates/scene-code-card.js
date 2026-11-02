// Example of a beat with a code card: 22.7's Parts beat. The card types one line of the real source, the styleguide
// answers, the cursor clicks the result open. Adapt SRC (verbatim lines), the lifted modules, the selectors and PARTS.
const { seg, eo, lerp } = kit;
// test-workspace/projects/test-lib/src/lib/components/list/list-item.component.ts, lines 22 to 27, verbatim
const SRC = [
    '@Showcase<ListItemComponent>({',
    "    title: 'List Item',",
    "    partOf: 'lib-list',",
    "    description: 'One entry of a lib-list.',",
    "    tags: ['list', 'item']",
    '})'
];
const TYPED = 2,
    INDENT = 4;
const PARTS = { type: 1.4, chips: 2.15, click: 3.8 };
const hl = (s) =>
    s
        .split(/('[^']*')/)
        .map((p, i) =>
            i % 2
                ? '<span class="parts-s">' + kit.esc(p) + '</span>'
                : kit
                      .esc(p)
                      .replace(/@Showcase/, '<span class="parts-d">@Showcase</span>')
                      .replace(/(\w+)(?=:)/g, '<span class="parts-k">$1</span>')
        )
        .join('');
kit.scene('parts', {
    init(kit) {
        kit.css(
            '.parts-veil{position:absolute;inset:0;background:linear-gradient(90deg, color-mix(in srgb, var(--ground) 97%, transparent) 0%, color-mix(in srgb, var(--ground) 90%, transparent) 34%, transparent 46%)}' +
                '.parts-card{position:absolute;left:84px;top:312px;width:620px;padding:22px 30px 26px;box-sizing:border-box;border-radius:16px;background:color-mix(in srgb, var(--ground) 86%, var(--indigo));box-shadow:0 30px 80px rgba(0,0,0,.45), 0 0 0 1px color-mix(in srgb, var(--second) 12%, transparent)}' +
                '.parts-file{margin:0 0 14px;font-size:16px;color:color-mix(in srgb, var(--second) 55%, var(--ground))}' +
                '.parts-code{position:relative;overflow:hidden;font-size:20px;line-height:30px;font-weight:500;color:#cbd5e1}' +
                '.parts-fade{position:absolute;right:0;top:0;bottom:0;width:90px;background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--ground) 86%, var(--indigo)))}' +
                '.parts-ln{display:block;white-space:pre;overflow:hidden;height:30px}' +
                '.parts-s{color:#86efac}.parts-k{color:#67e8f9}.parts-d{color:#e879f9}' +
                '.parts-caret{position:absolute;width:2px;height:24px;background:var(--second)}'
        );
        const v = UI.stage(kit, ['parts-before', 'parts-after']);
        this.v = v;
        kit.stage.append(kit.h('<div class="parts-veil"></div>'));
        const card = kit.h(
            '<div class="parts-card mono"><p class="parts-file">list-item.component.ts</p><div class="parts-code">' +
                SRC.map((l) => '<span class="parts-ln">' + hl(l) + '</span>').join('') +
                '<span class="parts-caret"></span><span class="parts-fade"></span></div></div>'
        );
        kit.stage.append(card);
        this.card = card.style;
        this.line = card.querySelectorAll('.parts-ln')[TYPED].style;
        this.caret = card.querySelector('.parts-caret').style;
        const probe = kit.h('<span style="position:absolute;visibility:hidden;white-space:pre">' + '0'.repeat(40) + '</span>');
        card.querySelector('.parts-code').append(probe);
        this.cw = probe.offsetWidth / 40;
        probe.remove();
        this.typed = kit.typist(SRC[TYPED].slice(INDENT), PARTS.type, 34);
        this.head = v.wins[0].querySelector('prism-head-parts').style;
        this.pop = v.wins[1].querySelector('.part-card').style;
        this.pop.transformOrigin = '0 0';
        const c = UI.box(kit, v, v.wins[0], '[data-v=part-chip]');
        const cx = c.x + c.w / 2,
            cy = c.y + c.h / 2,
            left = c.x - 271;
        v.c.set([
            { t: 0, cx: left + 200 / 1.5, cy: cy + 420 / 1.5, z: 1.5, hold: 2.5 },
            { t: 3.4, cx: left + 200 / 1.8, cy: cy + 420 / 1.8, z: 1.8, drift: [2, 1, 0.006] }
        ]);
        this.cap = UI.caption(kit, "A part shows **on its parent's page.**");
        const cur = kit.cursor();
        cur.keys = [
            { t: 2.6, at: UI.at(v, cx + 240, cy + 200) },
            { t: 3.6, at: UI.at(v, cx, cy), bow: -0.12 },
            { t: 3.95, at: UI.at(v, cx, cy) },
            { t: 4.7, at: UI.at(v, cx + 330, cy + 80), bow: 0.1 }
        ];
        cur.clicks = [PARTS.click];
        cur.visible = (t) => eo(seg(t, 2.5, 2.8)) * (1 - eo(seg(t, 5.2, 5.5)));
        this.cur = cur;
    },
    render(t, kit) {
        const v = this.v;
        v.c.apply(t);
        UI.open(kit, v, t);
        UI.showCap(kit, this.cap, t, 0.15);
        const k = eo(seg(t, 0.1, 0.5));
        this.card.opacity = String(k);
        this.card.transform = 'translateX(' + ((1 - k) * -24).toFixed(2) + 'px)';
        const n = INDENT + this.typed.count(t);
        this.line.width = (n * this.cw).toFixed(1) + 'px';
        this.caret.left = (n * this.cw + 1).toFixed(1) + 'px';
        this.caret.top = TYPED * 30 + 3 + 'px';
        const typing = t >= PARTS.type - 0.2 && t < this.typed.end + 0.05;
        this.caret.opacity = t < 1.2 || t > 3.0 ? '0' : typing ? '1' : String(Math.floor(t / 0.53) % 2);
        this.head.opacity = String(eo(seg(t, PARTS.chips, PARTS.chips + 0.3)));
        const p = eo(seg(t, PARTS.click + 0.04, PARTS.click + 0.24));
        v.wins[1].style.opacity = String(p);
        this.pop.transform = 'scale(' + lerp(0.96, 1, p).toFixed(4) + ')';
        this.cur.render(t);
    }
});
