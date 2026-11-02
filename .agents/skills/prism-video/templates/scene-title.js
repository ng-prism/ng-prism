const { seg, eo, ei, eio, lerp, clamp01 } = kit;
// The pill under the lockup: the release's minor ('22.7', set in mono), or for the tour the slogan (set in Inter).
const VERSION = '22.7';
const SLOGAN = !/^\d/.test(VERSION);
// Times in seconds. The film opens inside the mark's own light and pulls back until the prism is sharp; a flare runs
// through it as it lands, the name slides out from behind it, a sheen passes over the lockup.
const TT = { pull: 1.3, flare: 1.08, slide: 1.42, name: 1.52, ver: 2.2, sheen: 2.6, out: 3.7, end: 4.0 };
const WORD = 'ng-prism';
// The mark's three pieces as outlines in % of the 556x437 picture, for the glint.
const HULLS = [
    '19.42% 36.84%, 48.92% 0.23%, 42.81% 46.68%, 0.18% 99.08%',
    '52.7% 0.23%, 82.55% 36.61%, 99.46% 99.54%, 59.17% 45.08%, 52.34% 1.14%',
    '22.48% 93.59%, 51.08% 51.72%, 77.88% 93.36%'
];
const MH = 280,
    MW = Math.round((MH * 556) / 437),
    GAP = 62,
    CY = 470,
    Z0 = 9;
kit.scene('title', {
    init(kit) {
        kit.css(
            '.title-mg{position:absolute;left:0;top:0;width:0;height:0}' +
                '.title-glow{position:absolute;left:-640px;top:-300px;width:1280px;height:600px;border-radius:50%;background:radial-gradient(closest-side, color-mix(in srgb, var(--indigo) 50%, transparent), color-mix(in srgb, var(--accent) 20%, transparent) 60%, transparent);filter:blur(36px)}' +
                '.title-mark{position:absolute;left:' +
                -MW / 2 +
                'px;top:' +
                -MH / 2 +
                'px;width:' +
                MW +
                'px;height:' +
                MH +
                'px}' +
                '.title-img{position:absolute;inset:0;width:100%;height:100%}' +
                '.title-glint{position:absolute;inset:0;opacity:0;background:linear-gradient(110deg, transparent 40%, color-mix(in srgb, var(--second) 85%, transparent) 50%, transparent 60%) no-repeat;background-size:300% 100%}' +
                '.title-flare{position:absolute;left:0;width:1920px;height:0}' +
                '.title-flare i{position:absolute;left:0;right:0;display:block}' +
                '.title-flare .core{top:-2px;height:4px;background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--cyan) 80%, transparent) 25%, var(--second) 50%, color-mix(in srgb, var(--accent) 80%, transparent) 75%, transparent)}' +
                '.title-flare .haze{top:-40px;height:80px;filter:blur(22px);background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--cyan) 55%, transparent) 28%, color-mix(in srgb, var(--main) 70%, transparent) 50%, color-mix(in srgb, var(--accent) 55%, transparent) 72%, transparent)}' +
                '.title-word{position:absolute;margin:0;white-space:nowrap;font-size:196px;font-weight:700;letter-spacing:-.04em;line-height:1.2}' +
                '.title-ch{display:inline-block;background:linear-gradient(90deg, var(--cyan), var(--main) 38%, var(--indigo) 68%, var(--accent)) no-repeat;-webkit-background-clip:text;background-clip:text;color:transparent}' +
                '.title-sheen{position:absolute;margin:0;white-space:nowrap;font-size:196px;font-weight:700;letter-spacing:-.04em;line-height:1.2;color:transparent;-webkit-background-clip:text;background-clip:text;' +
                'background-image:linear-gradient(105deg, transparent 42%, color-mix(in srgb, var(--second) 90%, transparent) 50%, transparent 58%);background-repeat:no-repeat;background-size:300% 100%}' +
                '.title-ver{position:absolute;left:0;top:' +
                (CY + 200) +
                'px;margin:0;padding:14px 40px;border:2px solid transparent;border-radius:999px;font-size:46px;font-weight:500;letter-spacing:.06em;color:var(--second);' +
                'background:linear-gradient(color-mix(in srgb, var(--ground) 90%, var(--indigo)), color-mix(in srgb, var(--ground) 90%, var(--indigo))) padding-box, linear-gradient(90deg, var(--cyan), var(--main) 38%, var(--indigo) 68%, var(--accent)) border-box}'
        );
        kit.css('.title-slogan{font-size:38px;font-weight:500;letter-spacing:-.01em;padding:14px 38px}');
        kit.stage.append(kit.h('<div class="ground"></div>'));
        const img = kit.assets.url('symbol.png');
        const g = kit.h(
            '<div class="title-mg"><div class="title-glow"></div>' +
                '<div class="title-mark"><img class="title-img title-c1" src="' +
                img +
                '" alt=""><img class="title-img title-c2" src="' +
                img +
                '" alt=""><img class="title-img title-main" src="' +
                img +
                '" alt="">' +
                HULLS.map((h) => '<div class="title-glint" style="clip-path:polygon(' + h + ')"></div>').join('') +
                '</div></div>'
        );
        kit.stage.append(g);
        const flare = kit.h('<div class="title-flare" style="top:' + CY + 'px"><i class="haze"></i><i class="core"></i></div>');
        kit.stage.append(flare);
        const word = kit.h(
            '<p class="title-word">' +
                WORD.split('')
                    .map((c) => '<span class="title-ch">' + kit.esc(c) + '</span>')
                    .join('') +
                '</p>'
        );
        kit.stage.append(word);
        const sheen = kit.h('<p class="title-sheen">' + kit.esc(WORD) + '</p>');
        kit.stage.append(sheen);
        const ver = kit.h('<p class="title-ver' + (SLOGAN ? ' title-slogan' : ' mono') + '">' + kit.esc(VERSION) + '</p>');
        kit.stage.append(ver);
        const ww = word.offsetWidth,
            wh = word.offsetHeight;
        const left = (1920 - (MW + GAP + ww)) / 2;
        this.x0 = 960;
        this.x1 = left + MW / 2;
        this.mid = left + (MW + GAP + ww) / 2;
        const wx = left + MW + GAP,
            wy = CY - wh / 2 + 6;
        this.wx = wx;
        this.ww = ww;
        // the sheen's band runs from left of the mark (where it stands after the slide) to right of the name
        this.bx0 = this.x1 - MW / 2 - 160;
        this.bx1 = wx + ww + 160;
        word.style.left = sheen.style.left = wx.toFixed(1) + 'px';
        word.style.top = sheen.style.top = wy.toFixed(1) + 'px';
        this.ch = [...word.querySelectorAll('.title-ch')].map((n) => {
            n.style.backgroundSize = ww + 'px 100%';
            n.style.backgroundPosition = -n.offsetLeft + 'px 0';
            return n.style;
        });
        this.vw = ver.offsetWidth;
        this.g = g.style;
        this.glow = g.querySelector('.title-glow').style;
        this.mark = g.querySelector('.title-mark').style;
        this.main = g.querySelector('.title-main').style;
        this.c1 = g.querySelector('.title-c1').style;
        this.c2 = g.querySelector('.title-c2').style;
        this.glints = [...g.querySelectorAll('.title-glint')].map((n) => n.style);
        this.flare = flare.style;
        this.core = flare.querySelector('.core').style;
        this.haze = flare.querySelector('.haze').style;
        this.word = word.style;
        this.sheen = sheen.style;
        this.ver = ver.style;
    },
    render(t) {
        const out = ei(seg(t, TT.out, TT.end));
        // 1. from inside the light: the camera pulls back through a blurred field of the mark's colours until it is sharp
        const p = eio(seg(t, -0.15, TT.pull)),
            s = Math.exp(lerp(Math.log(Z0), 0, p)),
            k = (s - 1) / (Z0 - 1);
        const slide = eio(seg(t, TT.slide, TT.slide + 0.7));
        const gx0 = lerp(this.x0, this.x1, slide);
        this.g.transform = 'translate(' + gx0.toFixed(1) + 'px,' + CY + 'px)';
        // the name only shows right of the mark's edge, so it comes out from behind it
        const hide = Math.max(0, gx0 + (MW / 2) * s - 30 - this.wx);
        this.word.clipPath = 'inset(-60px -60px -60px ' + hide.toFixed(1) + 'px)';
        this.mark.transform = 'scale(' + (s * (1 - 0.03 * out)).toFixed(4) + ') rotate(' + (-16 * k).toFixed(2) + 'deg)';
        // one sheen, once the lockup stands, runs through the prism and on through the name, as on the end card;
        // the prism lights up while the band crosses it and keeps a soft glow from the landing on
        const sp = seg(t, TT.sheen, TT.sheen + 0.95),
            bx = lerp(this.bx0, this.bx1, eio(sp)),
            on = sp > 0 && sp < 1;
        const shine = on ? Math.max(0, 1 - Math.abs(bx - this.x1) / MW) : 0;
        const halo = eo(seg(t, TT.flare - 0.06, TT.flare + 0.4)) * (0.5 + 0.08 * Math.sin(t * 2.4)) + 0.5 * shine;
        this.main.filter =
            (k > 0.002 ? 'blur(' + (28 * k).toFixed(2) + 'px) ' : '') +
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
        // the prism splits its own light while it moves: two tinted copies drift apart and close up as it lands
        const split = 18 * k + 5 * (1 - eo(seg(t, 0.5, TT.pull)));
        const co = 0.6 * clamp01(k * 4) + 0.3 * (1 - eo(seg(t, 0.6, TT.pull)));
        this.c1.transform = 'translate(' + (-split).toFixed(2) + 'px,' + (split * 0.3).toFixed(2) + 'px)';
        this.c2.transform = 'translate(' + split.toFixed(2) + 'px,' + (-split * 0.3).toFixed(2) + 'px)';
        this.c1.filter = 'blur(' + (28 * k + 1.5).toFixed(2) + 'px) hue-rotate(-55deg)';
        this.c2.filter = 'blur(' + (28 * k + 1.5).toFixed(2) + 'px) hue-rotate(65deg)';
        this.c1.opacity = this.c2.opacity = String(co);
        this.mark.opacity = String(1 - out);
        // 2. the landing: one anamorphic flare through the prism, its light lifts the glow behind it a little
        const f = seg(t, TT.flare - 0.1, TT.flare + 0.3),
            fo = eo(f) * (1 - eio(seg(t, TT.flare + 0.25, TT.flare + 1.1)));
        this.core.transform = 'scaleX(' + eo(f).toFixed(4) + ')';
        this.haze.transform = 'scaleX(' + (0.4 + 0.6 * eo(f)).toFixed(4) + ')';
        this.flare.opacity = String(fo);
        const pulse = eo(seg(t, TT.flare - 0.15, TT.flare + 0.1)) * (1 - eio(seg(t, TT.flare + 0.1, TT.flare + 1.3)));
        this.glow.opacity = String(Math.min(1, 0.35 + 0.35 * eo(seg(t, 0.3, TT.pull)) + 0.2 * pulse) * (1 - out));
        this.glow.transform = 'scale(' + (lerp(1.6, 1, p) + 0.08 * pulse + 0.03 * Math.sin(t * 1.9)).toFixed(4) + ')';
        const pos = (left, w) => ((100 * (1.5 * w - (bx - left))) / (2 * w)).toFixed(2) + '% 0';
        for (const st of this.glints) {
            st.backgroundPosition = pos(this.x1 - MW / 2, MW);
            st.opacity = on ? '1' : '0';
        }
        // 3. the name slides out from behind the mark, letter by letter, out of focus into focus
        this.ch.forEach((st, i) => {
            const q = eo(seg(t, TT.name + i * 0.05, TT.name + i * 0.05 + 0.6));
            st.opacity = String(q * (1 - out));
            st.transform = 'translateX(' + ((1 - q) * -70).toFixed(2) + 'px)';
            st.filter = q < 1 ? 'blur(' + ((1 - q) * 14).toFixed(2) + 'px)' : 'none';
        });
        this.sheen.backgroundPosition = pos(this.wx, this.ww);
        this.sheen.opacity = String(on ? 1 - out : 0);
        // 4. the version, in a pill like the end card's
        const v = eo(seg(t, TT.ver, TT.ver + 0.6));
        this.ver.opacity = String(v * (1 - out));
        this.ver.transform = 'translate(' + (this.mid - this.vw / 2).toFixed(1) + 'px,' + ((1 - v) * 20).toFixed(2) + 'px)';
        this.ver.filter = v < 1 ? 'blur(' + ((1 - v) * 8).toFixed(2) + 'px)' : 'none';
    }
});
