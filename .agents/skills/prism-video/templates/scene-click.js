// Example of a UI beat: 22.7's Service pages beat. Two lifted states of the same window, a click, a cross-fade, then a
// camera move to where the result is. Adapt the modules, the data-v hook, the caption and the camera keys.
const { seg, eo } = kit;
const PAGES = { click: 2.5 };
kit.scene('pages', {
    init(kit) {
        const v = UI.stage(kit, ['svc-before', 'svc-after']);
        this.v = v;
        const s = UI.box(kit, v, v.wins[0], '[data-v=svc-item]');
        const sx = s.x + 92,
            sy = s.y + s.h / 2;
        this.cap = UI.caption(kit, 'Services and pipes get **their own pages.**');
        v.c.set([
            { t: 0, cx: 960, cy: 540, z: 1, hold: 0.6 },
            { t: 1.9, cx: s.x + 200, cy: sy - 20, z: 1.9, hold: 0.95 },
            { t: 4.0, cx: 960, cy: 400, z: 1.4, drift: [3, 0, 0.005] }
        ]);
        const cur = kit.cursor();
        cur.keys = [
            { t: 1.0, at: UI.at(v, sx + 260, sy + 120) },
            { t: 2.3, at: UI.at(v, sx, sy), bow: 0.1 },
            { t: 3.6, at: UI.at(v, sx, sy) }
        ];
        cur.clicks = [PAGES.click];
        cur.visible = (t) => eo(seg(t, 0.9, 1.2)) * (1 - eo(seg(t, 3.0, 3.3)));
        this.cur = cur;
    },
    render(t, kit) {
        const v = this.v;
        v.c.apply(t);
        UI.open(kit, v, t);
        UI.showCap(kit, this.cap, t, 0.15);
        v.wins[1].style.opacity = String(eo(seg(t, PAGES.click + 0.05, PAGES.click + 0.25)));
        this.cur.render(t);
    }
});
