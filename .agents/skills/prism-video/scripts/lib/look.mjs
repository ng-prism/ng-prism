// The films' look: brand colours, local fonts, the CSS every scene shares, the cursor and the word-by-word caption.
// Paths are relative to the generated HyperFrames project (`assets/…`), which the build fills.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const n2 = (n) => Math.round(n * 100) / 100;

export const GRAD = 'linear-gradient(90deg,#00cfea,#078bfa 38%,#244bff 68%,#a20cf0)';
export const SPECTRUM = ['#00cfea', '#078bfa', '#244bff', '#6b1ff7', '#a20cf0'];

// Own family names, so HyperFrames finds no 'Inter' to fetch from Google Fonts; the lifted CSS gets them through
// --sans and --mono on the window.
export const FONTS = `@font-face{font-family:'Inter Prism';font-weight:100 900;font-display:block;src:url('assets/fonts/inter-var.woff2') format('woff2')}
@font-face{font-family:'JBM Prism';font-weight:100 800;font-display:block;src:url('assets/fonts/jbmono-var.woff2') format('woff2')}`;

export const BASE = `
#root{position:absolute;inset:0;overflow:hidden;font-family:'Inter Prism',sans-serif;color:#f1f5f9}
.ground{position:absolute;inset:0;background:
 radial-gradient(circle 672px at 14% 46%,rgb(0 207 234 / 20%),transparent),
 radial-gradient(circle 710px at 40% 60%,rgb(36 75 255 / 20%),transparent),
 radial-gradient(circle 960px at 82% 40%,rgb(162 12 240 / 20%),transparent),#080d19}
.fill{position:absolute;inset:0}
.persp{position:absolute;inset:0;perspective:2200px}
.cam{position:absolute;left:0;top:0;width:1920px;height:1080px}
.win{--sans:'Inter Prism';--mono:'JBM Prism';--ngp-logo:url('assets/img/symbol.png');position:absolute;top:90px;left:240px;width:1440px;height:900px;overflow:hidden;border-radius:12px;
 box-shadow:0 40px 120px rgb(0 0 0 / 55%),0 0 0 1px rgb(241 245 249 / 10%)}
.win *,.win *::before,.win *::after{transition:none!important;animation:none!important}
.win .prism-header__sheen::after{transform:translateX(var(--sheen,-100%))!important}
.win .prism-header__glow::after{opacity:var(--swell-o,0)!important;transform:scale(var(--swell-s,.9))!important}
.scrim{position:absolute;right:0;bottom:0;left:0;height:324px;background:linear-gradient(to bottom,transparent,rgb(8 13 25 / 88%) 50%,rgb(8 13 25 / 94%))}
.cap{position:absolute;top:930px;right:0;left:0;margin:0;font-size:52px;font-weight:700;line-height:1.1;text-align:center;letter-spacing:-.02em;color:#f1f5f9}
.cap .w{display:inline-block;white-space:pre}
.em{color:transparent;background-image:${GRAD};-webkit-background-clip:text;background-clip:text}
.hi{position:absolute;border:3px solid #078bfa;border-radius:10px;box-shadow:0 0 0 6px rgb(7 139 250 / 22%),0 0 34px rgb(0 207 234 / 40%)}
.cur{position:absolute;left:0;top:0;width:0;height:0}
.cur-z,.cur-p{position:absolute;left:0;top:0;width:0;height:0}
.cur-p{opacity:0}
.cur svg{position:absolute;left:-4px;top:-3px;width:34px;height:34px;filter:drop-shadow(0 3px 6px rgb(0 0 0 / 45%))}
.rip{position:absolute;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:3px solid #00cfea;box-shadow:0 0 22px rgb(0 207 234 / 65%),inset 0 0 12px rgb(162 12 240 / 45%)}
.flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#fff,rgb(0 207 234 / 85%) 22%,rgb(36 75 255 / 70%) 45%,rgb(162 12 240 / 55%) 70%,#080d19 100%)}
`;

export const CURSOR = `<svg viewBox="0 0 24 24"><path d="M3 2.5 L3 19.5 L7.4 15.4 L10.3 21.8 L13.4 20.4 L10.6 14.1 L16.6 14.1 Z" fill="#fff" stroke="#0b1220" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

// Word spans for a line with its **closing part** in the brand gradient; the gradient words share one gradient.
export const words = (text) =>
    text
        .split('**')
        .flatMap((p, i) =>
            p
                .split(/(?<= )/)
                .filter(Boolean)
                .map((w, k, all) => {
                    const g =
                        i % 2 ? ` em" style="background-size:${all.length * 100}% 100%;background-position:${all.length > 1 ? (k / (all.length - 1)) * 100 : 0}% 0` : '';
                    return `<span class="w${g}">${esc(w)}</span>`;
                })
        )
        .join('');

// The caption of a scene: a scrim over the lower third and one line, word by word.
export const capHtml = (id, text) => `<div class="scrim" id="${id}-scrim"></div><p class="cap" id="${id}-cap">${words(text)}</p>`;
