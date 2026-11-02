// "Real light" for the title and the end card: a WebGL shader draws ground, beam, spectrum, flare, bloom, haze, dust and
// grain from the scene's time alone; the DOM on top carries the prism (drawn in light, then filled), the name and the
// words. The title sends white light into the prism and the spectrum out; the end card runs it the other way round.
import { GRAD, esc, n2, words } from './look.mjs';
import { sounds } from './beats.mjs';
import { TL, composition } from './timeline.mjs';

export const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uT, uGround, uBeamF, uBeamFar, uTip, uBeamA, uFanNear, uFanL, uFanS, uFanR, uFanA, uFlare, uBloom, uFront, uFrontA, uHaze;
uniform vec2 uP;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vn(p);p*=2.03;a*=.5;}return v;}
// smoothstep with its edges in order (reversed edges are undefined in GLSL)
float rise(float a,float b,float x){return smoothstep(a,b,x);}
float fall(float a,float b,float x){return 1.-smoothstep(a,b,x);}
vec3 spec(float u){
 u=clamp(u*.5+.5,0.,1.);
 vec3 c0=vec3(0.,.81,.92),c1=vec3(.027,.545,.98),c2=vec3(.141,.294,1.),c3=vec3(.635,.047,.94);
 if(u<.33) return mix(c0,c1,u/.33);
 if(u<.66) return mix(c1,c2,(u-.33)/.33);
 return mix(c2,c3,(u-.66)/.34);
}
float dust(vec2 p,float cell,float t,float seed){
 vec2 id=floor(p/cell);float m=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
  vec2 c=id+vec2(float(i),float(j));float r=h21(c+seed);
  if(r>.3)continue;
  vec2 o=vec2(h21(c+seed+1.7),h21(c+seed+4.1));
  vec2 pos=(c+o)*cell+vec2(sin(t*.35+r*40.)*10.,-t*7.*(.5+r));
  float d=length(p-pos);float sz=.8+1.6*h21(c+seed+9.3);
  m+=exp(-d*d/(2.*sz*sz))*(.45+.55*h21(c+seed+2.2));
 }
 return m;
}
vec3 ground(vec2 p){
 vec3 g=mix(vec3(.02,.031,.059),vec3(.031,.051,.098),uGround);
 float a=max(0.,1.-length(p-vec2(.14,.46)*uRes)/672.);
 float b=max(0.,1.-length(p-vec2(.40,.60)*uRes)/710.);
 float c=max(0.,1.-length(p-vec2(.82,.40)*uRes)/960.);
 g+=uGround*.2*(a*vec3(0.,.81,.92)+b*vec3(.141,.294,1.)+c*vec3(.635,.047,.94));
 return g;
}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
 float t=uT;
 vec3 L=vec3(0.);
 // white light on the line through the prism from the upper left: lit between uBeamF and uBeamFar (distance
 // upstream of the prism), a hot core, a halo with drifting haze in it, a bright tip at uTip
 vec2 db=vec2(.98769,.15643);
 vec2 w=uP-p;float al=dot(w,db);float pe=abs(w.x*db.y-w.y*db.x);
 float on=rise(uBeamF-40.,uBeamF+40.,al)*fall(uBeamFar-40.,uBeamFar+40.,al)*rise(-6.,30.,al);
 float vol=.7+.6*fbm(vec2(al*.005-t*.35,pe*.025));
 float beam=(exp(-pe*pe/(2.*1.6*1.6))*1.5+exp(-pe/9.)*.5*vol+exp(-pe/60.)*.14*vol)*on;
 float tip=exp(-((al-uTip)*(al-uTip)+pe*pe)/(2.*26.*26.))*1.4*step(1.,uTip);
 L+=vec3(.92,.97,1.)*(beam+tip)*uBeamA;
 // the spectrum: a continuous fan on the prism's right, lit between uFanNear and uFanL, soft edges, fine filaments,
 // white where it meets the glass
 vec2 v=p-uP;float r=length(v);
 float u=(atan(v.y,v.x)-uFanR)/max(uFanS,.001);
 float edge=fall(.7,1.25,abs(u));
 float reach=fall(uFanL-220.,uFanL,r)*rise(uFanNear,uFanNear+220.,r)*rise(20.,90.,r);
 float fil=.6+.4*vn(vec2(u*14.,r*.0016-t*.07))+.2*(vn(vec2(u*64.,r*.003+t*.02))-.5);
 float dim=1./(1.+r/1200.);
 float conc=pow(clamp(.23/max(uFanS,.01),1.,6.),.5);
 float fan=edge*reach*fil*dim*uFanA*.9*conc;
 vec3 fc=mix(spec(u),vec3(1.),exp(-r/150.)*.8);
 float halo=exp(-u*u*.3)*reach*dim*uFanA*.1*conc;
 L+=fc*fan+spec(clamp(u,-1.,1.))*halo;
 // a comet running out along the gathered light, setting the name alight
 float dx=r-uFront;
 float fr=(dx<0.?exp(dx/260.):exp(-dx*dx/(2.*18.*18.)))*exp(-pow(v.y/(14.+18.*exp(min(dx,0.)/300.)),2.))*step(1.,uFront)*step(0.,v.x)*uFrontA;
 L+=mix(vec3(1.),spec(clamp(-dx/400.,-1.,1.)),.45)*fr*1.3;
 // the impact: an anamorphic streak and a bloom; the bloom also carries the dive into the prism
 vec2 d=p-uP;
 L+=vec3(.55,.8,1.)*(exp(-d.y*d.y/(2.*2.2*2.2))*exp(-abs(d.x)/520.)*1.4+exp(-d.y*d.y/(2.*18.*18.))*exp(-abs(d.x)/320.)*.35)*uFlare;
 float rp=length(d);
 L+=vec3(.85,.93,1.)*(exp(-rp/60.)*1.2+exp(-rp/260.)*.4)*uBloom;
 // a faint spectral haze behind the lockup while it holds
 vec2 hz=(p-vec2(960.,uP.y))/vec2(820.,190.);
 L+=spec(clamp((p.x-960.)/700.,-1.,1.))*exp(-dot(hz,hz))*uHaze;
 // dust in the air, visible where light falls on it
 float lum=dot(L,vec3(.333));
 float ds=dust(p,64.,t,1.)+.6*dust(p+vec2(311.,97.),118.,t*.7,7.);
 vec3 tint=mix(vec3(.8,.9,1.),L/max(lum,.02)*.5,.5);
 L+=tint*ds*(.035*uGround+lum*2.4);
 L=1.-exp(-L*1.3);
 vec3 g=ground(p);
 vec3 col=g+L*(1.-g);
 col+=(h21(p+fract(t*7.13)*100.)-.5)*.02;
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

const UNIFORMS = [
    'uRes',
    'uT',
    'uP',
    'uGround',
    'uBeamF',
    'uBeamFar',
    'uTip',
    'uBeamA',
    'uFanNear',
    'uFanL',
    'uFanS',
    'uFanR',
    'uFanA',
    'uFlare',
    'uBloom',
    'uFront',
    'uFrontA',
    'uHaze'
];

// The scene's canvas, drawn by a tween over the whole scene: its onUpdate hands the scene's own time to `light(t)`,
// which returns the uniforms. GSAP calls it on every seek, so the picture follows the playhead and nothing else.
const lightScript = (id, dur, light) => `const cv = document.getElementById('${id}-gl');
    const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, mk(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, ${JSON.stringify(FRAG)}));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const n of ${JSON.stringify(UNIFORMS)}) U[n] = gl.getUniformLocation(pr, n);
    const E = (n) => gsap.parseEase(n);
    const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a))), lerp = (a, b, k) => a + (b - a) * k;
    const hit = (t, at, decay) => (t < at - 0.02 ? 0 : Math.min(1, (t - at + 0.02) / 0.04) * Math.exp(-Math.max(0, t - at - 0.02) / decay));
    const light = ${light};
    function renderAt(t) {
      const u = { uFanNear: 0, uBeamF: 0, uBeamFar: 1e5, uTip: 0, uFront: 0, uFrontA: 0, uHaze: 0, ...light(t) };
      gl.viewport(0, 0, 1920, 1080);
      gl.uniform2f(U.uRes, 1920, 1080);
      gl.uniform1f(U.uT, t);
      gl.uniform2f(U.uP, u.px, u.py);
      for (const n of ${JSON.stringify(UNIFORMS.slice(3))}) gl.uniform1f(U[n], u[n]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
    }
    const clock = { t: 0 };
    tl.fromTo(clock, { t: 0 }, { t: ${dur}, duration: ${dur}, ease: 'none', onUpdate: () => renderAt(clock.t) }, 0);
    renderAt(0);`;

// percentages of the 556x437 mark: the three facets' outlines
const HULLS = [
    [19.42, 36.84, 48.92, 0.23, 42.81, 46.68, 0.18, 99.08],
    [52.7, 0.23, 82.55, 36.61, 99.46, 99.54, 59.17, 45.08, 52.34, 1.14],
    [22.48, 93.59, 51.08, 51.72, 77.88, 93.36]
];
const pts = (h) => {
    const o = [];
    for (let i = 0; i < h.length; i += 2) o.push(`${((h[i] * 556) / 100).toFixed(1)},${((h[i + 1] * 437) / 100).toFixed(1)}`);
    return o.join(' ');
};
const edgesSvg = (id) =>
    `<svg class="l-edges" id="${id}-edges" viewBox="0 0 556 437">${HULLS.map((h, i) => `<polygon id="${id}-e${i}" pathLength="1" points="${pts(h)}"/>`).join('')}</svg>`;
const WORD = 'ng-prism';
const LIGHT_CSS = `
.l-gl{position:absolute;left:0;top:0;width:1920px;height:1080px}
.l-g{position:absolute;left:0;width:0;height:0}
.l-mark{position:absolute}
.l-mark img{position:absolute;inset:0;width:100%;height:100%}
.l-edges{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 12px #7fe6ff) drop-shadow(0 0 30px rgb(36 75 255 / 80%))}
.l-edges polygon{fill:none;stroke:#fff;stroke-width:2.4;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1 1}
.l-glint{position:absolute;inset:0;-webkit-mask:url('assets/img/symbol.png') center/contain no-repeat;mask:url('assets/img/symbol.png') center/contain no-repeat;
 background:linear-gradient(105deg,transparent 40%,rgb(255 255 255 / 92%) 50%,transparent 60%) no-repeat;background-size:300% 100%;opacity:0}
.l-word{position:absolute;margin:0;white-space:nowrap;font-weight:700;letter-spacing:-.04em;line-height:1.2}
.l-ch{display:inline-block;color:transparent;background-image:${GRAD};background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text}
.l-sheen{color:transparent;background:linear-gradient(105deg,transparent 42%,rgb(255 255 255 / 90%) 50%,transparent 58%) no-repeat;background-size:300% 100%;-webkit-background-clip:text;background-clip:text;opacity:0}
`;
// Prism and name side by side, centred; the name's letters share one gradient over its measured width.
const lockup = ({ word, fs, MH, GAP, CY }) => {
    const MW = Math.round((MH * 556) / 437);
    const left = (1920 - (MW + GAP + word.w)) / 2;
    const X1 = n2(left + MW / 2),
        WX = n2(left + MW + GAP),
        WY = n2(CY - word.h / 2 + fs / 32);
    const letters = WORD.split('')
        .map((ch, i) => `<span class="l-ch" style="background-size:${n2(word.w)}px 100%;background-position:${-n2(word.xs[i])}px 0">${esc(ch)}</span>`)
        .join('');
    return { MW, X1, WX, WY, letters, SPAN: Math.round(WX + word.w - X1 + 40) };
};
const mark = (id) =>
    `<div class="l-mark" id="${id}-mark"><img id="${id}-img" src="assets/img/symbol.png" alt="">${edgesSvg(id)}<div class="l-glint" id="${id}-glint"></div></div>`;
// the prism drawn in light, then filled; each letter of the name lit as the comet passes it
const drawPrism = (tl, id, at) => {
    [0, 1, 2].forEach((i) =>
        tl.ft(`#${id}-e${i}`, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, duration: 0.42, ease: 'power2.out' }, at + i * 0.05)
    );
    tl.ft(`#${id}-edges`, { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power1.in' }, at + 0.6);
    tl.ft(
        `#${id}-img`,
        { opacity: 0, filter: 'brightness(3) saturate(0.3) blur(5px)' },
        { opacity: 1, filter: 'brightness(1) saturate(1) blur(0px)', duration: 0.8, ease: 'power2.out' },
        at + 0.17
    );
};
const ignite = (tl, id, { word, WX, X1, SPAN }, [a, b]) => {
    WORD.split('').forEach((_, i) => {
        const w = (i + 1 < WORD.length ? word.xs[i + 1] : word.w) - word.xs[i];
        const at = a + (b - a) * Math.min(1, Math.sqrt((WX + word.xs[i] + w / 2 - X1) / SPAN));
        tl.ft(
            `#${id}-word .l-ch:nth-child(${i + 1})`,
            { opacity: 0, filter: 'brightness(3.5) blur(10px)', scale: 1.12 },
            { opacity: 1, filter: 'brightness(1) blur(0px)', scale: 1, duration: 0.45, ease: 'power2.out' },
            at - 0.05
        );
    });
};
const sheen = (tl, id, at) => {
    tl.ft(`#${id}-glint`, { opacity: 1, backgroundPosition: '150% 0' }, { opacity: 1, backgroundPosition: '-50% 0', duration: 0.5, ease: 'power2.inOut' }, at);
    tl.set(`#${id}-glint`, { opacity: 0 }, at + 0.52);
    tl.ft(`#${id}-sheen`, { opacity: 1, backgroundPosition: '150% 0' }, { opacity: 1, backgroundPosition: '-50% 0', duration: 0.75, ease: 'power2.inOut' }, at + 0.25);
    tl.set(`#${id}-sheen`, { opacity: 0 }, at + 1.02);
};
const shake = (tl, sel, at) =>
    tl.ft(
        sel,
        { x: 0, y: 0 },
        {
            keyframes: [
                { x: -8, y: 5, duration: 0.04 },
                { x: 7, y: -4, duration: 0.04 },
                { x: -4, y: 2, duration: 0.05 },
                { x: 0, y: 0, duration: 0.06 }
            ]
        },
        at
    );

// The second of the title where prism, name and line hold together: the web version's first frame and the thumbnail.
export const TITLE_LOCKUP = 3.4;

/**
 * The title: white light from the upper left hits the prism, the prism draws itself in light and fills, the spectrum
 * fans out, gathers into a band that sets the name alight, the line comes in under a hairline of the spectrum, one
 * sheen, then a flight into the prism. spec: { id, dur, line, word } — `line` is the tour's slogan (Inter, with a
 * **closing part** in the gradient) or a release's version (starts with a digit: mono); `word` is the name's measured
 * box at 196 px: { w, h, xs[] } (xs = the left edge of each letter).
 */
export function title({ id, dur, line, word }) {
    const MH = 280,
        CY = 470;
    const L = lockup({ word, fs: 196, MH, GAP: 62, CY });
    const { MW, X1, WX, WY, SPAN } = L;
    const version = /^\d/.test(line);
    const s = sounds();
    const style = `${LIGHT_CSS}
#${id}-g{top:${CY}px}
#${id}-mark{left:${-MW / 2}px;top:${-MH / 2}px;width:${MW}px;height:${MH}px}
#${id}-word,#${id}-sheen{left:${WX}px;top:${WY}px;font-size:196px}
.t-rule{position:absolute;left:${960 - 300}px;top:${CY + 150}px;width:600px;height:2px;background:linear-gradient(90deg,transparent,#00cfea 20%,#078bfa 40%,#244bff 60%,#a20cf0 80%,transparent);box-shadow:0 0 14px rgb(36 75 255 / 80%),0 0 30px rgb(0 207 234 / 35%)}
.t-line-txt{position:absolute;left:0;right:0;top:${CY + 172}px;margin:0;text-align:center;font-size:44px;font-weight:500;letter-spacing:-.01em;color:#dbe4f0}
.t-line-txt .w{display:inline-block;white-space:pre}
.t-ver{font-family:'JBM Prism',monospace;font-size:56px;letter-spacing:.06em;top:${CY + 166}px}
`;
    const body = `    <div class="fill" id="${id}-cam" data-layout-allow-overflow>
      <div class="fill" id="${id}-all">
        <canvas class="l-gl" id="${id}-gl" width="1920" height="1080"></canvas>
        <div class="l-g" id="${id}-g">
          ${mark(id)}
        </div>
        <p class="l-word" id="${id}-word">${L.letters}</p>
        <p class="l-word l-sheen" id="${id}-sheen">${WORD}</p>
        <div class="t-rule" id="${id}-rule"></div>
        <p class="t-line-txt${version ? ' t-ver' : ''}" id="${id}-line">${words(line)}</p>
      </div>
    </div>
    <div class="flash" id="${id}-out" style="opacity:0"></div>`;
    const IMPACT = 0.6,
        SLIDE = [1.35, 2.0],
        IGNITE = [2.0, 2.55],
        EXIT = dur - 0.75;
    const tl = new TL();
    tl.raw(
        lightScript(
            id,
            dur,
            `(t) => {
      const io2 = E('power2.inOut'), o2 = E('power2.out'), eo = E('expo.out'), in1 = E('power1.in');
      const beamA = 1 - in1(seg(t, ${SLIDE[0] + 0.05}, ${SLIDE[1] - 0.05}));
      const front = lerp(1100, 0, E('power1.in')(seg(t, 0.12, ${IMPACT})));
      return {
        px: lerp(960, ${X1}, E('power3.inOut')(seg(t, ${SLIDE[0]}, ${SLIDE[1]}))), py: ${CY},
        uGround: o2(seg(t, ${IMPACT - 0.05}, ${IMPACT + 1.0})),
        uBeamF: front, uTip: front, uBeamA: beamA,
        uFanL: 2600 * eo(seg(t, ${IMPACT + 0.02}, ${IMPACT + 0.8})),
        uFanS: lerp(lerp(0.015, 0.23, eo(seg(t, ${IMPACT + 0.02}, ${IMPACT + 0.55}))), 0.09, io2(seg(t, 1.9, 2.4))),
        uFanR: lerp(0.12, 0, io2(seg(t, ${SLIDE[0]}, 2.4))),
        uFanA: 1 - o2(seg(t, 2.3, 2.75)),
        uFlare: hit(t, ${IMPACT}, 0.14),
        uBloom: hit(t, ${IMPACT}, 0.55) + 0.16 * beamA * (t > ${IMPACT} ? 1 : 0) + 2.4 * Math.pow(seg(t, ${EXIT}, ${dur - 0.1}), 2),
        uFront: t < ${IGNITE[0]} ? 0 : lerp(0, ${SPAN}, o2(seg(t, ${IGNITE[0]}, ${IGNITE[1]}))),
        uFrontA: 1 - seg(t, ${IGNITE[1] - 0.05}, ${IGNITE[1] + 0.25}),
        uHaze: 0.15 * o2(seg(t, 2.3, 3.2)) * (1 - seg(t, ${EXIT}, ${EXIT + 0.4}))
      };
    }`
        )
    );
    // the camera: a slow pull back while the light builds, then a slow push while the lockup holds
    tl.ft(`#${id}-cam`, { scale: 1.07 }, { scale: 1, duration: 2.3, ease: 'power2.out' }, 0);
    tl.ft(`#${id}-cam`, { scale: 1 }, { scale: 1.03, duration: n2(EXIT - 2.3), ease: 'none', immediateRender: false }, 2.3);
    tl.ft(`#${id}-g`, { x: 960 }, { x: X1, duration: n2(SLIDE[1] - SLIDE[0]), ease: 'power3.inOut' }, SLIDE[0]);
    drawPrism(tl, id, IMPACT - 0.02);
    shake(tl, `#${id}-all`, IMPACT - 0.02);
    ignite(tl, id, { word, WX, X1, SPAN }, IGNITE);
    // the line under a hairline of the spectrum
    tl.ft(`#${id}-rule`, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.55);
    tl.ft(`#${id}-line .w`, { opacity: 0, filter: 'blur(8px)', y: 12 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.3, stagger: 0.07, ease: 'expo.out' }, 2.7);
    sheen(tl, id, 3.55);
    // into the prism
    tl.raw(`gsap.set('#${id}-all', { transformOrigin: '${X1}px ${CY}px' });`);
    tl.ft(`#${id}-all`, { scale: 1, filter: 'blur(0px)' }, { scale: 9, filter: 'blur(12px)', duration: 0.75, ease: 'power3.in', immediateRender: false }, EXIT);
    tl.ft(`#${id}-out`, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.in' }, dur - 0.3);
    s.add('whoosh', 0.12, 0.45);
    s.add('impact-bass-1', IMPACT - 0.04, 0.75);
    s.add('whoosh-short', SLIDE[0], 0.3);
    s.add('whoosh-short', IGNITE[0], 0.22);
    s.add('whoosh-cinematic', EXIT - 0.3, 0.5, 1.6);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}

/**
 * The end card, the title's light run the other way: the spectrum flows in from the right and drains into the prism,
 * white light shoots out to the upper left, a narrow band sets the name alight, the command types itself into its pill
 * (`ng add @ng-prism/core` for the tour, `ng update @ng-prism/core` for a release), the address under it, one sheen.
 * spec: { id, dur, command, word } — `word` is the name's measured box at 136 px.
 */
export function end({ id, dur, command, word }) {
    const MH = 190,
        CY = 420;
    const L = lockup({ word, fs: 136, MH, GAP: 48, CY });
    const { MW, X1, WX, WY, SPAN } = L;
    const s = sounds();
    const cmdChars = [...command].map((ch, i) => `<span id="${id}-k${i}" style="opacity:0">${esc(ch)}</span>`).join('');
    const style = `${LIGHT_CSS}
#${id}-g{top:${CY}px;left:${X1}px}
#${id}-mark{left:${-MW / 2}px;top:${-MH / 2}px;width:${MW}px;height:${MH}px}
#${id}-word,#${id}-sheen{left:${WX}px;top:${WY}px;font-size:136px}
.e-cmdrow{position:absolute;left:0;right:0;top:${CY + 150}px;text-align:center}
.e-cmd{display:inline-block;position:relative;margin:0;padding:24px 52px;border:3px solid transparent;border-radius:999px;font-family:'JBM Prism',monospace;font-size:46px;font-weight:500;color:#f1f5f9;
 background:linear-gradient(rgb(14 20 44 / 88%),rgb(14 20 44 / 88%)) padding-box,${GRAD} border-box;box-shadow:0 0 50px rgb(36 75 255 / 40%);white-space:pre}
.e-caret{display:inline-block;width:3px;height:48px;margin-left:4px;vertical-align:-8px;background:#f1f5f9;box-shadow:0 0 10px #00cfea}
.e-url{position:absolute;left:0;right:0;top:${CY + 300}px;margin:0;text-align:center;font-family:'JBM Prism',monospace;font-size:30px;color:#8a98b3}
`;
    const body = `    <div class="fill" id="${id}-cam" data-layout-allow-overflow>
      <div class="fill" id="${id}-all">
        <canvas class="l-gl" id="${id}-gl" width="1920" height="1080"></canvas>
        <div class="l-g" id="${id}-g">
          ${mark(id)}
        </div>
        <p class="l-word" id="${id}-word">${L.letters}</p>
        <p class="l-word l-sheen" id="${id}-sheen">${WORD}</p>
        <div class="e-cmdrow"><p class="e-cmd" id="${id}-cmd">${cmdChars}<span class="e-caret" id="${id}-caret"></span></p></div>
        <p class="e-url" id="${id}-url">github.com/ng-prism/ng-prism</p>
      </div>
    </div>`;
    const IMPACT = 0.6,
        IGNITE = [0.95, 1.45];
    const tl = new TL();
    tl.raw(
        lightScript(
            id,
            dur,
            `(t) => {
      const o2 = E('power2.out'), in2 = E('power2.in');
      // 1. the spectrum flows in from the right and drains into the prism; 2. a narrow band runs out along the name
      const back = t >= 0.92;
      const tail = lerp(2600, 0, in2(seg(t, 0.38, 0.9)));
      const front = t < ${IGNITE[0]} ? 0 : lerp(0, ${SPAN}, o2(seg(t, ${IGNITE[0]}, ${IGNITE[1]})));
      const far = lerp(0, 1150, o2(seg(t, ${IMPACT}, ${IMPACT + 0.4})));
      const beamA = 1 - o2(seg(t, 1.15, 1.75));
      return {
        px: ${X1}, py: ${CY},
        uGround: lerp(0.35, 1, o2(seg(t, ${IMPACT - 0.1}, ${IMPACT + 1.0}))),
        uBeamF: 0, uBeamFar: far, uTip: far, uBeamA: t < ${IMPACT} ? 0 : beamA,
        uFanNear: back ? 0 : lerp(${Math.round(1920 - X1 + 60)}, 0, E('power1.in')(seg(t, 0.0, ${IMPACT - 0.02}))),
        uFanL: back ? front + 80 : tail,
        uFanS: back ? 0.09 : 0.2,
        uFanR: back ? 0 : 0.1,
        uFanA: back ? 1 - o2(seg(t, ${IGNITE[1] - 0.1}, ${IGNITE[1] + 0.35})) : 1,
        uFlare: hit(t, ${IMPACT}, 0.14),
        uBloom: hit(t, ${IMPACT}, 0.55) + 0.14 * beamA * (t > ${IMPACT} ? 1 : 0),
        uFront: front,
        uFrontA: 1 - seg(t, ${IGNITE[1] - 0.05}, ${IGNITE[1] + 0.25}),
        uHaze: 0.15 * o2(seg(t, 1.4, 2.3))
      };
    }`
        )
    );
    tl.ft(`#${id}-cam`, { scale: 1.05 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);
    tl.ft(`#${id}-cam`, { scale: 1 }, { scale: 1.025, duration: n2(dur - 1.6), ease: 'none', immediateRender: false }, 1.6);
    drawPrism(tl, id, IMPACT - 0.04);
    shake(tl, `#${id}-all`, IMPACT - 0.02);
    ignite(tl, id, { word, WX, X1, SPAN }, IGNITE);
    // the command, typed into its pill at 34 characters a second; the address under it
    tl.ft(`#${id}-cmd`, { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 1.6);
    const T0 = 1.88;
    [...command].forEach((_, i) => tl.set(`#${id}-k${i}`, { opacity: 1 }, T0 + i / 34));
    const TE = T0 + command.length / 34;
    for (let k = 0; k < 6; k++) tl.set(`#${id}-caret`, { opacity: k % 2 ? 1 : 0 }, TE + 0.25 + k * 0.5);
    tl.ft(`#${id}-url`, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, TE + 0.1);
    sheen(tl, id, 3.1);
    s.add('whoosh-cinematic', 0, 0.42, 0.9);
    s.add('impact-bass-1', IMPACT - 0.04, 0.7);
    s.add('whoosh-short', IMPACT + 0.02, 0.3);
    s.add('whoosh-short', IGNITE[0], 0.22);
    s.add('typing', T0, 0.32, TE - T0 + 0.05);
    return { html: composition({ id, dur, style, body, tl }), sfx: s.list };
}
