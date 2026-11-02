const { seg, eo, eio, lerp, clamp01 } = kit;
// A release film ends on the update, the tour on the install.
const COMMAND = 'ng update @ng-prism/core';
// The end card: the same lockup as the title, settling in place; once it stands, one sheen runs through the prism and
// the name, and the prism glows up as the light crosses it.
const TT = { cmd: 0.45, url: 0.75, sheen: 1.15, pass: 0.95 };
const WORD = 'ng-prism';
const HULLS = [
    '19.42% 36.84%, 48.92% 0.23%, 42.81% 46.68%, 0.18% 99.08%',
    '52.7% 0.23%, 82.55% 36.61%, 99.46% 99.54%, 59.17% 45.08%, 52.34% 1.14%',
    '22.48% 93.59%, 51.08% 51.72%, 77.88% 93.36%'
];
const MH = 190,
    MW = Math.round((MH * 556) / 437);
const BAND = 'linear-gradient(105deg, transparent 42%, color-mix(in srgb, var(--second) 88%, transparent) 50%, transparent 58%) no-repeat';
kit.scene('end', {
    init(kit) {
        kit.css(
            '.end-group{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:58px;padding-bottom:30px}' +
                '.end-glow{position:absolute;left:50%;top:50%;width:1200px;height:520px;margin:-330px 0 0 -600px;border-radius:50%;background:radial-gradient(closest-side, color-mix(in srgb, var(--indigo) 38%, transparent), color-mix(in srgb, var(--accent) 14%, transparent) 60%, transparent);filter:blur(36px)}' +
                '.end-row{position:relative;display:flex;align-items:center;gap:48px}' +
                '.end-mark{position:relative;width:' +
                MW +
                'px;height:' +
                MH +
                'px}' +
                '.end-img{position:absolute;inset:0;width:100%;height:100%}' +
                '.end-glint{position:absolute;inset:0;opacity:0;background:' +
                BAND +
                ';background-size:300% 100%}' +
                '.end-word{position:relative;margin:0;white-space:nowrap;font-size:136px;font-weight:700;letter-spacing:-.04em;line-height:1.2}' +
                '.end-sheen{position:absolute;inset:0;margin:0;opacity:0;color:transparent;-webkit-background-clip:text;background-clip:text;background:' +
                BAND +
                ';background-size:300% 100%;-webkit-background-clip:text;background-clip:text}' +
                '.end-cmd{margin:0;padding:24px 48px;border:3px solid transparent;border-radius:999px;font-size:44px;font-weight:500;color:var(--second);' +
                'background:linear-gradient(color-mix(in srgb, var(--ground) 88%, var(--indigo)), color-mix(in srgb, var(--ground) 88%, var(--indigo))) padding-box, linear-gradient(90deg, var(--cyan), var(--main) 38%, var(--indigo) 68%, var(--accent)) border-box}' +
                '.end-url{margin:-24px 0 0;font-size:30px}'
        );
        kit.stage.append(kit.h('<div class="ground"></div>'));
        const img = kit.assets.url('symbol.png');
        const g = kit.h(
            '<div class="end-group"><div class="end-glow"></div>' +
                '<div class="end-row"><div class="end-mark"><img class="end-img" src="' +
                img +
                '" alt="">' +
                HULLS.map((h) => '<div class="end-glint" style="clip-path:polygon(' + h + ')"></div>').join('') +
                '</div>' +
                '<p class="end-word brand">' +
                WORD +
                '<span class="end-sheen">' +
                WORD +
                '</span></p></div>' +
                '<p class="end-cmd mono">' +
                kit.esc(COMMAND) +
                '</p><p class="end-url mono muted">github.com/ng-prism/ng-prism</p></div>'
        );
        kit.stage.append(g);
        const m = kit.srect(g.querySelector('.end-mark')),
            w = kit.srect(g.querySelector('.end-word'));
        this.m = m;
        this.w = w;
        this.x0 = m.x - 160;
        this.x1 = w.x + w.w + 160;
        this.g = g.style;
        this.glow = g.querySelector('.end-glow').style;
        this.row = g.querySelector('.end-row').style;
        this.img = g.querySelector('.end-img').style;
        this.glints = [...g.querySelectorAll('.end-glint')].map((n) => n.style);
        this.sheen = g.querySelector('.end-sheen').style;
        this.cmd = g.querySelector('.end-cmd').style;
        this.url = g.querySelector('.end-url').style;
    },
    render(t) {
        const r = eo(seg(t, 0, 0.8));
        this.row.opacity = String(eo(seg(t, 0, 0.35)));
        this.row.transform = 'scale(' + lerp(0.95, 1, r).toFixed(4) + ')';
        const c = eo(seg(t, TT.cmd, TT.cmd + 0.45));
        this.cmd.opacity = String(c);
        this.cmd.transform = 'translateY(' + ((1 - c) * 18).toFixed(2) + 'px)';
        const u = eo(seg(t, TT.url, TT.url + 0.45));
        this.url.opacity = String(u);
        this.url.transform = 'translateY(' + ((1 - u) * 14).toFixed(2) + 'px)';
        // one band of light runs left to right through the prism and on through the name
        const p = seg(t, TT.sheen, TT.sheen + TT.pass),
            x = lerp(this.x0, this.x1, eio(p)),
            on = p > 0 && p < 1;
        const pos = (b) => ((100 * (1.5 * b.w - (x - b.x))) / (2 * b.w)).toFixed(2) + '% 0';
        for (const s of this.glints) {
            s.backgroundPosition = pos(this.m);
            s.opacity = on ? '1' : '0';
        }
        this.sheen.backgroundPosition = pos(this.w);
        this.sheen.opacity = on ? '1' : '0';
        // the prism lights up while the band crosses it, then keeps a soft glow
        const d = Math.abs(x - (this.m.x + this.m.w / 2)) / this.m.w,
            shine = on ? Math.max(0, 1 - d) : 0;
        const halo = eo(seg(t, 0.2, 0.9)) * (0.5 + 0.08 * Math.sin(t * 2.4)) + 0.5 * shine;
        this.img.filter =
            'brightness(' +
            (1 + 0.45 * shine).toFixed(3) +
            ')' +
            ' drop-shadow(0 0 ' +
            (6 + 18 * shine).toFixed(1) +
            'px color-mix(in srgb, var(--cyan) ' +
            Math.round(70 * halo) +
            '%, transparent))' +
            ' drop-shadow(0 0 ' +
            (16 + 40 * shine).toFixed(1) +
            'px color-mix(in srgb, var(--accent) ' +
            Math.round(45 * halo) +
            '%, transparent))';
        this.glow.opacity = String(0.55 * eo(seg(t, 0, 0.8)) + 0.25 * eo(seg(t, TT.sheen, TT.sheen + 0.5)) * (1 - eio(seg(t, TT.sheen + 0.5, TT.sheen + 1.6))));
        this.g.transform = 'scale(' + lerp(1, 1.015, clamp01(t / 4)).toFixed(4) + ')';
    }
});
