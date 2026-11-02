/* What every product scene shares: the lifted styleguide in a window on the brand ground, a camera, the caption. */
/* The styleguide's own CSS, lifted from its builds (test-lib: ui-test.css, video-lib scoped .ngv: ui-video.css, test-lib at phone size scoped .ngm: ui-phone.css), once for
   the whole film; a film may hold either or both. */
for (const name of ['ui-test.css', 'ui-video.css', 'ui-phone.css']) {
    const css = kit.module(name);
    if (css) kit.css(css);
}

window.UI = {
    stage: function (kit, mods) {
        kit.stage.style.setProperty('--ngp-logo', 'url(' + kit.assets.url('symbol.png') + ')');
        kit.stage.append(kit.h('<div class="ground"></div>'));
        var cam = kit.h('<div class="cam"></div>');
        kit.stage.append(cam);
        var wins = mods.map(function (m, i) {
            var w = kit.h('<div class="win"></div>');
            w.innerHTML = kit.module(m + '.html');
            if (i > 0) w.style.opacity = '0';
            cam.append(w);
            return w;
        });
        return { cam: cam, c: new kit.Camera(cam), wins: wins };
    },
    /* an element's box in the camera's scene space; measure in init, before the camera moves */
    box: function (kit, v, w, sel) {
        var el = w.querySelector(sel);
        if (!el) throw new Error('UI.box: no ' + sel);
        return kit.camrect(el, v.c);
    },
    caption: function (kit, text) {
        var html = text
            .split('**')
            .map(function (p, i) {
                return i % 2 ? '<span class="em">' + kit.esc(p) + '</span>' : kit.esc(p);
            })
            .join('');
        var sc = kit.h('<div class="scrim"></div>');
        kit.stage.append(sc);
        var cap = kit.h('<p class="cap">' + html + '</p>');
        kit.stage.append(cap);
        return { sc: sc, cap: cap };
    },
    showCap: function (kit, c, t, t0) {
        var p = kit.eo(kit.seg(t, t0, t0 + 0.4));
        c.sc.style.opacity = String(p);
        c.cap.style.opacity = String(p);
        c.cap.style.transform = 'translateY(' + ((1 - p) * 14).toFixed(2) + 'px)';
    },
    /* a scene point as a stage point under the camera; call v.c.apply(t) first */
    at: function (v, x, y) {
        return function () {
            var s = v.c.state;
            return [s.tx + x * s.z, s.ty + y * s.z];
        };
    },
    /* the window comes up from the ground after a cut */
    open: function (kit, v, t) {
        v.cam.style.opacity = String(kit.eo(kit.seg(t, 0, 0.3)));
    },
    /* the header's brand light, driven from t: p 0..1 moves the sheen along the edge, o and s swell the glow */
    light: function (kit, w, p, o, s) {
        var sh = w.querySelector('.prism-header__sheen'),
            gl = w.querySelector('.prism-header__glow');
        if (sh) sh.style.setProperty('--sheen', kit.lerp(-100, 400, p).toFixed(1) + '%');
        if (gl) {
            gl.style.setProperty('--swell-o', o.toFixed(3));
            gl.style.setProperty('--swell-s', s.toFixed(3));
        }
    }
};
