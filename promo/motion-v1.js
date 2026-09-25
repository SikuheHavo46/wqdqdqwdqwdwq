'use strict';
// ---------- timing ----------
const BPM = 120, BEAT = 60 / BPM, BARS = 7, T = BARS * 4 * BEAT; // 14 s
const b = n => n * BEAT;
const wrap = t => ((t % T) + T) % T;
const clamp = (x, a = 0, c = 1) => Math.min(c, Math.max(a, x));
const mix = (a, c, k) => a + (c - a) * k;
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// Closed-form step response of a damped spring (0 -> 1). zeta >= 0.82 keeps overshoot under ~1%.
function step(tau, w, z) {
  if (tau <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
// color is critically damped and quick so black <-> white swaps don't linger in mid-gray
const SP = { shape: [16, .86], cam: [11, 1], curX: [15, .9], curY: [12.5, .9], fast: [26, .9], lead: [30, .9], lag: [13, .88], ui: [20, .86], color: [34, 1] };

// A track is a sum of one spring per target change. The value before the first event equals the
// last target and the previous cycle's springs are included, so f(0) === f(T), velocity included.
function track(evs, def = SP.shape) {
  evs = evs.slice().sort((p, q) => p[0] - q[0]);
  const n = evs.length, arr = Array.isArray(evs[0][1]);
  const base = evs[n - 1][1];
  const E = evs.map((e, i) => {
    const prev = evs[(i - 1 + n) % n][1];
    return { t: e[0], d: arr ? e[1].map((v, k) => v - prev[k]) : e[1] - prev, p: e[2] || def };
  });
  return t => {
    t = wrap(t);
    let v = arr ? base.slice() : base;
    for (const e of E) for (const off of [0, T]) {
      const s = step(t - e.t + off, e.p[0], e.p[1]);
      if (s === 0) continue;
      if (arr) for (let k = 0; k < v.length; k++) v[k] += e.d[k] * s; else v += e.d * s;
    }
    return v;
  };
}
// Content swap: exit (0.09 s) ends before enter (delay 0.09 s) starts, so swapped text never overlaps.
function vis(t, tin, tout, dIn = .09, durIn = .22, dOut = .09) {
  const f = x => {
    const e = easeOut((x - tin - dIn) / durIn), q = clamp((x - tout) / dOut);
    return { o: e * (1 - q), bl: 12 * (1 - e) + 10 * q, s: .95 + .05 * e - .03 * q };
  };
  const t0 = wrap(t);
  return [f(t0), f(t0 + T), f(t0 - T)].reduce((m, x) => (x.o > m.o ? x : m));
}
const rgb = c => `rgb(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')})`;

// ---------- design tokens ----------
const ACC = [0, 113, 227], INK = [17, 17, 17], BLK = [0, 0, 0], WHT = [255, 255, 255];
const SW = 4.5; // screen-px stroke for every line icon
const S = { // size on screen at rest (px) and the camera scale that frames it
  btn: { W: 560, H: 168, R: 84, S: 2.8, bg: INK },
  load: { W: 168, H: 168, R: 84, S: 2.8, bg: INK },
  check: { W: 192, H: 192, R: 96, S: 3.0, bg: ACC },
  island: { W: 860, H: 160, R: 80, S: 2.6, bg: BLK },
  player: { W: 1040, H: 520, R: 72, S: 2.0, bg: INK },
  slider: { W: 1000, H: 160, R: 80, S: 2.3, bg: WHT },
  toggle: { W: 360, H: 208, R: 104, S: 4.0, bg: INK },
  tabs: { W: 1080, H: 168, R: 84, S: 2.4, bg: WHT },
  chart: { W: 1120, H: 860, R: 64, S: 1.6, bg: WHT },
  key: { W: 280, H: 280, R: 64, S: 4.0, bg: INK },
  pal: { W: 1040, H: 682, R: 48, S: 2.0, bg: WHT },
  toast: { W: 960, H: 168, R: 84, S: 2.4, bg: INK },
};
const wW = k => S[k].W / S[k].S, wH = k => S[k].H / S[k].S, wR = k => S[k].R / S[k].S;
// Extra camera zoom per state on top of S. Content still rasterises at its final scale (no will-change).
const Z = { btn: 1.3, load: 1.35, check: 1.3, island: 1.22, player: 1.14, slider: 1.12, toggle: 1.25, tabs: 1.14, chart: 1.1, key: 1.25, pal: 1.1, toast: 1.2 };

// ---------- icons (24-grid, stroke normalised to SW screen px) ----------
const IC = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5"/>',
  flask: '<path d="M9.5 3.5h5M10.5 3.5v5.5L5 18.5A1.5 1.5 0 0 0 6.3 20.5h11.4a1.5 1.5 0 0 0 1.3-2L13.5 9V3.5M7.5 15h9"/>',
  sparkle: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
  enter: '<path d="M19 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4"/>',
  cmd: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z"/>',
  spk: '<path d="M11 5.2L6.6 8.6H3.8a.8.8 0 0 0-.8.8v5.2a.8.8 0 0 0 .8.8h2.8l4.4 3.4z"/>',
  w1: '<path d="M15.5 9a4.5 4.5 0 0 1 0 6"/>',
  w2: '<path d="M18.5 6.2a8.5 8.5 0 0 1 0 11.6"/>',
};
const icon = (n, px) =>
  `<svg class="ln" width="${px}" height="${px}" viewBox="0 0 24 24" stroke-width="${(SW * 24 / px).toFixed(3)}">${IC[n]}</svg>`;

// ---------- DOM ----------
const shape = document.getElementById('shape'), world = document.getElementById('world'), stage = document.getElementById('stage');
function add(parent, html, cls = 'c') {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d;
}
const $ = (root, sel) => root.querySelector(sel);

// Content layers are laid out in screen px and scaled 1/S, so they are 1:1 on screen at rest.
const C = {};
function content(key, html, w, h, z = 1) {
  const el = add(shape, html); el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.zIndex = z; C[key] = el; return el;
}

content('btn', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:20px;color:#fff">
  <span style="font-size:56px;font-weight:600;letter-spacing:-.8px">Начать</span><span class="arr">${icon('arrow', 48)}</span></div>`, 560, 168);

content('load', `<svg width="168" height="168" viewBox="0 0 168 168">
  <circle cx="84" cy="84" r="40" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="9"/>
  <circle class="arc" cx="84" cy="84" r="40" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" pathLength="1"/></svg>`, 168, 168);

content('check', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff">
  <svg class="ln" width="96" height="96" viewBox="0 0 24 24" stroke-width="${(SW * 1.35 * 24 / 96).toFixed(3)}"><path class="ck" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`, 192, 192);

content('island', `<div style="width:100%;height:100%;display:flex;align-items:center;color:#fff">
  <div style="width:104px;height:104px;border-radius:52px;background:${rgb(ACC)};margin-left:28px;display:flex;align-items:center;justify-content:center">${icon('compass', 56)}</div>
  <div style="margin-left:26px;flex:1"><div style="font-size:40px;font-weight:600;letter-spacing:-.4px">Диагностика</div>
  <div style="font-size:28px;color:#8E8E93;margin-top:4px">12 вопросов · 5 минут</div></div>
  <div class="eq" style="display:flex;align-items:center;gap:9px;margin-right:52px;height:64px">${'<i style="display:block;width:9px;border-radius:5px;background:#fff"></i>'.repeat(5)}</div></div>`, 860, 160);

const PLAY = [[[14, 6], [32, 17.5], [32, 46.5], [14, 58]], [[32, 17.5], [54, 32], [54, 32], [32, 46.5]]];
const PAUSE = [[[13, 7], [26, 7], [26, 57], [13, 57]], [[38, 7], [51, 7], [51, 57], [38, 57]]];
content('player', `<div style="position:relative;width:100%;height:100%;color:#fff">
  <div class="abs" style="left:56px;top:56px;width:176px;height:176px;border-radius:34px;background:${rgb(ACC)};display:flex;align-items:center;justify-content:center">${icon('compass', 84)}</div>
  <div class="abs" style="left:268px;top:84px;font-size:46px;font-weight:600;letter-spacing:-.6px">Диагностика интересов</div>
  <div class="abs" style="left:268px;top:146px;font-size:32px;color:#8E8E93">Вопрос 4 из 12 · Карьерный навигатор</div>
  <div class="abs" style="left:56px;top:285px;width:928px;height:10px;border-radius:5px;background:#3A3A3C;overflow:hidden"><div class="fill" style="height:100%;background:#fff;width:0"></div></div>
  <div class="abs knob" style="left:0;top:276px;width:28px;height:28px;border-radius:50%;background:#fff;transform-origin:50% 50%"></div>
  <div class="abs tl" style="left:56px;top:318px;font-size:28px;color:#8E8E93">0:00</div>
  <div class="abs tr" style="right:56px;top:318px;font-size:28px;color:#8E8E93">-0:00</div>
  <svg class="abs" style="left:304px;top:406px" width="48" height="48" viewBox="0 0 48 48"><path fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round" d="M9 9h5v30H9zM40 9L18 24l22 15z"/></svg>
  <svg class="abs pp" style="left:484px;top:394px;transform-origin:36px 36px" width="72" height="72" viewBox="0 0 64 64"><path fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>
  <svg class="abs" style="left:688px;top:406px" width="48" height="48" viewBox="0 0 48 48"><path fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round" d="M34 9h5v30h-5zM8 9l22 15L8 39z"/></svg>
  </div>`, 1040, 520);

// The slider fill lives in world units so it can follow the rubber-band stretch.
const fill = add(shape, ''); fill.style.background = '#111'; fill.style.zIndex = 1;
content('slider', `<div style="width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;color:#fff;padding:0 60px">
  <svg class="ln" width="60" height="60" viewBox="0 0 24 24" stroke-width="${(SW * 24 / 60).toFixed(3)}">${IC.spk}<g class="w1">${IC.w1}</g><g class="w2">${IC.w2}</g></svg>
  <span class="pct" style="font-size:48px;font-weight:600;letter-spacing:-.5px">0%</span></div>`, 1000, 160, 2);
C.slider.style.mixBlendMode = 'difference'; // white over the fill, black over the empty track

// Tabs: gray labels / knob / white labels clipped to the knob.
const TABS = ['Вакансии', 'Навыки', 'Пробы'];
const tabRow = col => `<div style="width:100%;height:100%;display:flex;color:${col}">${TABS.map(s => `<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:500;letter-spacing:-.3px">${s}</div>`).join('')}</div>`;
content('tabsBg', `<div style="width:100%;height:100%;border-radius:84px;background:#F1F0EE"></div>`, 1080, 168, 1);
content('tabsG', tabRow('#6E6E73'), 1080, 168, 2);
const knob = add(shape, ''); knob.style.zIndex = 3;
content('tabsW', tabRow('#fff'), 1080, 168, 4);

// Chart
const CH = { x0: 64, x1: 1056, y0: 420, y1: 744, vals: [48, 62, 57, 84, 101, 128], max: 140, months: ['Сен', 'Окт', 'Ноя', 'Дек', 'Янв', 'Фев'] };
CH.pts = CH.vals.map((v, i) => [CH.x0 + i * (CH.x1 - CH.x0) / 5, CH.y1 - v / CH.max * (CH.y1 - CH.y0)]);
function smoothPath(p) {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, k = 1 / 6;
    d += ` C${p1[0] + (p2[0] - p0[0]) * k} ${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k} ${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const LINE = smoothPath(CH.pts);
content('chart', `<div style="position:relative;width:100%;height:100%">
  <div class="abs" style="left:64px;top:196px;font-size:34px;color:#6E6E73">Подходящие вакансии</div>
  <div class="abs num" style="left:60px;top:238px;font-size:112px;font-weight:600;letter-spacing:-4px;line-height:1">0</div>
  <div class="abs chip" style="left:292px;top:268px;background:#E6F0FC;color:${rgb(ACC)};font-size:30px;font-weight:600;padding:8px 18px;border-radius:40px;transform-origin:0 50%">+24%</div>
  <svg class="abs" style="left:0;top:0" width="1120" height="860" viewBox="0 0 1120 860">
    <defs><clipPath id="reveal"><rect class="rv" x="0" y="0" height="860" width="0"/></clipPath></defs>
    <line x1="64" x2="1056" y1="${CH.y1 + 2}" y2="${CH.y1 + 2}" stroke="#ECEBE8" stroke-width="2"/>
    <line class="guide" y1="${CH.y0 - 20}" y2="${CH.y1}" stroke="#E2E1DE" stroke-width="2"/>
    <g clip-path="url(#reveal)">
      <path d="${LINE} L${CH.x1} ${CH.y1} L${CH.x0} ${CH.y1}Z" fill="${rgb(ACC)}" fill-opacity=".07"/>
      <path d="${LINE}" fill="none" stroke="${rgb(ACC)}" stroke-width="5" stroke-linecap="round"/>
    </g>
    ${CH.pts.map(p => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="9" fill="#fff" stroke="${rgb(ACC)}" stroke-width="5"/>`).join('')}
    ${CH.months.map((m, i) => `<text x="${CH.pts[i][0]}" y="800" text-anchor="middle" font-size="26" fill="#8E8E93" font-family="Geist">${m}</text>`).join('')}
  </svg>
  <div class="abs tip" style="left:0;top:0;width:300px;height:100px;border-radius:22px;background:#111;color:#fff;white-space:nowrap">
    <div class="tipa abs" style="left:24px;top:14px"><div style="font-size:24px;color:#8E8E93">Январь</div><div style="font-size:34px;font-weight:600;margin-top:2px">101 вакансия</div></div>
    <div class="tipb abs" style="left:24px;top:14px"><div style="font-size:24px;color:#8E8E93">Февраль</div><div style="font-size:34px;font-weight:600;margin-top:2px">128 вакансий</div></div>
  </div></div>`, 1120, 860, 5);

content('key', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;color:#fff">
  ${icon('cmd', 76)}<span style="font-size:96px;font-weight:500;letter-spacing:-2px;line-height:1">K</span></div>`, 280, 280);

const ITEMS = [
  { t: 'Стажировки', h: 'Работа', i: 'briefcase' }, { t: 'Составить маршрут', h: 'Маршрут', i: 'route' },
  { t: 'Профессиональные пробы', h: 'Пробы', i: 'flask' }, { t: 'Диагностика интересов', h: 'Тест', i: 'compass' },
  { t: 'ИИ-помощник', h: 'Чат', i: 'sparkle' }];
const KEYS = [[b(24.5), 'с'], [b(25), 'ст'], [b(25.5), 'ста']];
content('pal', `<div style="position:relative;width:100%;height:100%">
  <div class="abs" style="left:40px;top:44px;color:#111">${icon('search', 40)}</div>
  <div class="abs" style="left:102px;top:36px;font-size:44px;letter-spacing:-.4px;height:56px;display:flex;align-items:center;white-space:pre">
    <span class="ph" style="color:#8E8E93;position:absolute;left:0">Поиск по порталу</span><span class="q"></span><span class="caret" style="display:inline-block;width:4px;height:50px;border-radius:2px;background:${rgb(ACC)};margin-left:3px"></span></div>
  <div class="abs kbd" style="right:40px;top:44px">esc</div>
  <div class="abs" style="left:0;right:0;top:127px;height:2px;background:#EDECE9"></div>
  ${ITEMS.map((it, i) => `<div class="row it" data-i="${i}" style="top:0">
    <div class="ibox">${icon(it.i, 36)}</div>
    <div class="lbl" style="margin-left:28px;font-size:36px;letter-spacing:-.3px;flex:1;white-space:pre"></div>
    <div class="hint" style="margin-right:24px;font-size:28px;color:#8E8E93">${it.h}</div>
    <div class="ent kbd" style="margin-right:24px;display:none;color:#111;padding:6px 10px">${icon('enter', 28)}</div></div>`).join('')}
  </div>`, 1040, 682, 2);

content('toast', `<div style="width:100%;height:100%;display:flex;align-items:center;color:#fff">
  <div style="width:104px;height:104px;border-radius:52px;background:${rgb(ACC)};margin-left:32px;display:flex;align-items:center;justify-content:center">${icon('check', 56)}</div>
  <div style="margin-left:28px"><div style="font-size:42px;font-weight:600;letter-spacing:-.5px">Отклик отправлен</div>
  <div style="font-size:30px;color:#8E8E93;margin-top:4px">Стажировка · Frontend-разработчик</div></div></div>`, 960, 168);

const cursor = add(stage, `<svg width="46" height="60" viewBox="0 0 23 30"><path d="M1.5 1.5v22.2l5.6-5.1 3.6 8.4 3.9-1.7-3.6-8.2 7.6-.3z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`, '');
cursor.id = 'cursor';

// ---------- timeline ----------
const PAL_H = n => 128 + 2 + 16 + n * 104 + 16; // palette height (screen px) for n rows
const SEQ = [ // [beat, state]
  [0, 'btnHover'], [1, 'load'], [3, 'check'], [4, 'island'], [5, 'player'], [10, 'slider'], [14, 'toggle'], [15, 'toggleOn'],
  [16, 'tabs'], [19, 'chart'], [23, 'key'], [24, 'pal'], [24.5, 'pal4'], [25, 'pal3'], [25.5, 'pal2'], [26, 'toast'], [27, 'btn']];
function stateDims(k) {
  if (k === 'btnHover') return { w: wW('btn') + 7, h: wH('btn'), r: wR('btn'), bg: INK, S: S.btn.S * Z.btn };
  if (k === 'toggleOn') return { w: wW('toggle'), h: wH('toggle'), r: wR('toggle'), bg: ACC, S: S.toggle.S * Z.toggle };
  if (/^pal\d$/.test(k)) return { w: wW('pal'), h: PAL_H(+k[3]) / 2, r: wR('pal'), bg: WHT, S: S.pal.S * Z.pal };
  return { w: wW(k), h: wH(k), r: wR(k), bg: S[k].bg, S: S[k].S * Z[k] };
}
const dims = SEQ.map(([bb, k]) => [b(bb), stateDims(k)]);
const palTop = -wH('pal') / 2;
const centerY = (d, i) => (/^pal/.test(SEQ[i][1]) ? palTop + d.h / 2 : 0); // palette shrinks with its top edge pinned
const trW = track(dims.map(([t, d]) => [t, d.w]));
const trH = track(dims.map(([t, d]) => [t, d.h]));
const trR = track(dims.map(([t, d]) => [t, d.r]));
// Shrinking into a dark state: recolor once the shape is small, so a big area never flashes mid-gray.
const COLOR_DELAY = { key: .14, toast: .1, toggle: .08 };
const trBg = track(dims.map(([t, d], i) => [t + (COLOR_DELAY[SEQ[i][1]] || 0), d.bg]), SP.color);
const trCy = track(dims.map(([t, d], i) => [t, centerY(d, i)]));
const trCam = track(dims.map(([t, d]) => [t, d.S]), SP.cam);
const trCamY = track(dims.map(([t, d], i) => [t, centerY(d, i)]), SP.cam);

// shape press feedback
const trPress = track([1, 5, 15, 24, 27].map(b).flatMap(t => [[t - .07, .965, SP.fast], [t + .06, 1, SP.ui]]));

// cursor (world coordinates, hotspot = arrow tip)
const PLAYER_KNOB_Y = (290 - 260) / 2, PROG = p => -232 + 464 * p;
const P_PLAY0 = 0.28, P_RATE = 0.018;
const chartW = (x, y) => [(x - 560) / 1.6, (y - 430) / 1.6];
const pt4 = chartW(...CH.pts[4]), pt5 = chartW(...CH.pts[5]);
const sL = -wW('slider') / 2, sWd = wW('slider'), S_V0 = 0.46;
const CUR = [
  [b(1) + .12, [78, 60]],
  [b(4) + .1, [72, 12]],
  [b(5) + .12, [3, 88]],
  [b(6) + .14, [PROG(P_PLAY0 + (b(7) - b(6)) * P_RATE), PLAYER_KNOB_Y + 2]],
  [b(7) + .04, [92, 20]],
  [b(8), [18, 16]],
  [b(9) + .12, [44, 62]],
  [b(10) + .12, [sL + sWd * S_V0, 10]],
  [b(11) + .04, [262, 14]],
  [b(12), [312, 20]],
  [b(13) + .12, [250, 44]],
  [b(14) + .12, [8, 9]],
  [b(15) + .12, [44, 42]],
  [b(16) + .12, [6, 9]],
  [b(17) + .12, [-146, 10]],
  [b(18) + .14, [-120, 70]],
  [b(21) - .24, [pt4[0] + 3, pt4[1] + 5]],
  [b(22) - .24, [pt5[0] + 3, pt5[1] + 5]],
  [b(23) + .04, [6, 10]],
  [b(24) + .12, [214, 150]],
  [b(26) + .12, [118, 12]],
  [b(27) + .12, [20, 13]],
];
// y rides a slightly softer spring than x, so moves arc instead of sliding in straight lines
const trCX = track(CUR.map(([t, p]) => [t, p[0]]), SP.curX);
const trCY = track(CUR.map(([t, p]) => [t, p[1]]), SP.curY);
const clicks = [1, 5, 6, 15, 17, 18, 24, 27].map(b);
const drags = [[b(7), b(9)], [b(11), b(13)]];
const trCurS = track(clicks.flatMap(t => [[t - .07, .84, SP.fast], [t + .05, 1, SP.ui]])
  .concat(drags.flatMap(([a, c]) => [[a - .05, .84, SP.fast], [c, 1, SP.ui]])));

// Scrub (drag 1): value follows the cursor while held, keeps playing after release.
const pressOffset = trCX(b(7)) - PROG(P_PLAY0 + (b(7) - b(6)) * P_RATE);
function playerP(t) {
  const x = wrap(t);
  if (x < b(6)) return P_PLAY0;
  if (x < b(7)) return P_PLAY0 + (x - b(6)) * P_RATE;
  if (x < b(9)) return clamp((trCX(x) - pressOffset + 232) / 464);
  return playerP(b(9) - 1e-6) + (x - b(9)) * P_RATE;
}
// Slider (drag 2): value + rubber band past max; on release the band springs back from where it was.
const sOff = trCX(b(11)) - (sL + sWd * S_V0);
const RUB = 42;
function sliderRaw(x) {
  const cx = trCX(x) - sOff, o = Math.max(0, cx - (sL + sWd));
  return { v: clamp((cx - sL) / sWd), s: RUB * (1 - Math.exp(-o / RUB)) };
}
function slider(t) {
  const x = wrap(t);
  if (x < b(11)) return { v: S_V0, s: 0 };
  if (x < b(13)) return sliderRaw(x);
  const r = sliderRaw(b(13) - 1e-6);
  return { v: r.v, s: r.s * (1 - step(x - b(13), 17, .82)) };
}

// Windowed tracks get a "prime" event while hidden, so they don't spring in from their last target.
const PRIME = b(10);
// Knob edges: the leading edge rides a stiff spring, the trailing edge a soft one.
const tabX = i => [-220 + i * 440 / 3, -220 + (i + 1) * 440 / 3];
const KN = [ // [t, left, right, direction]
  [PRIME, -41, 3, 0], [b(15), -3, 41, 1], [b(16), ...tabX(2), 0], [b(17), ...tabX(1), -1], [b(18), ...tabX(0), -1]];
// direction 0 = grow with the shape, so the knob never outruns the container edge
const edge = (d, leadIf) => (d === 0 ? SP.shape : d === leadIf ? SP.lead : SP.lag);
const trKL = track(KN.map(([t, l, , d]) => [t, l, edge(d, -1)]));
const trKR = track(KN.map(([t, , r, d]) => [t, r, edge(d, 1)]));
const trKT = track([[PRIME, -22], [b(16), -30]]);
const trKCol = track([[PRIME, WHT], [b(16), INK]], SP.color);
const trKSh = track([[PRIME, .28], [b(16), 0]], SP.ui);
const ROW_Y_CHART = -wH('chart') / 2 + 24 + 35;
const trRowY = track([[PRIME, 0], [b(19), ROW_Y_CHART]]);
const trRowBg = track([[PRIME, 0], [b(19), 1]], SP.ui);

const trPP = track([[b(6), 1], [b(10), 0]], SP.fast); // play -> pause morph
const trPPs = track([[b(6) - .07, .86, SP.fast], [b(6) + .05, 1, SP.ui]]);
const trKnobS = track([[b(7) - .04, 1.45, SP.ui], [b(9), 1, SP.ui]]);
const trHover = track([[b(0), 1, SP.ui], [b(1), 0, SP.ui]]);
const trTipX = track([[PRIME, 0], [b(22), 1]], SP.ui);
const trChip = track([[b(20), 1, SP.ui], [b(23), 0]]);

// chart line reveal
const DRAW0 = b(19) + .12, DRAW1 = b(20) + .02;
const drawP = t => easeInOut((wrap(t) - DRAW0) / (DRAW1 - DRAW0));
const dotTimes = CH.pts.map(p => { // first time the reveal passes each point (bisection keeps it pure)
  const f = (p[0] - CH.x0 + 4) / (CH.x1 - CH.x0 + 8); let lo = DRAW0, hi = DRAW1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (drawP(m) < f) lo = m; else hi = m; }
  return hi;
});

// ---------- render ----------
const blur = (el, px) => { el.style.filter = px > .05 ? `blur(${px.toFixed(2)}px)` : 'none'; };
function place(el, t, tin, tout, sc, ox, oy, g, opt) {
  const v = vis(t, tin, tout, ...(opt || []));
  if (v.o <= 0.001) { el.style.visibility = 'hidden'; return v; }
  el.style.visibility = 'visible';
  el.style.opacity = v.o.toFixed(4);
  blur(el, v.bl);
  el.style.transform = `translate(${g.w / 2 + ox - g.cx}px,${g.h / 2 + oy - g.cy}px) scale(${sc * v.s}) translate(-50%,-50%)`;
  return v;
}

function seek(tRaw) {
  const t = wrap(tRaw);
  const sl = slider(t);
  let w = trW(t), h = trH(t), r = trR(t), cy = trCy(t), cx = 0;
  if (t >= b(10) && t < b(14)) { w += sl.s; cx = sl.s / 2; h *= 1 - .1 * sl.s / RUB; }
  r = Math.min(r, h / 2, w / 2);
  shape.style.width = w + 'px'; shape.style.height = h + 'px';
  shape.style.left = (cx - w / 2) + 'px'; shape.style.top = (cy - h / 2) + 'px';
  shape.style.borderRadius = r + 'px'; shape.style.background = rgb(trBg(t));
  shape.style.transform = `scale(${trPress(t)})`;
  const g = { w, h, cx, cy };

  // Soft-min against "shape fits the frame": the lagging camera may never push a growing shape out of frame.
  const fit = Math.min(1360 / (w * trPress(t)), 1360 / h), K = .06;
  const c0 = trCam(t), cam = -K * Math.log(Math.exp(-c0 / K) + Math.exp(-fit / K)), camY = trCamY(t);
  world.style.transform = `translate(720px,720px) scale(${cam}) translate(0px,${-camY}px)`;

  const L = (key, tin, tout, sK, ox = 0, oy = 0, opt) => place(C[key], t, tin, tout, 1 / sK, ox, oy, g, opt);

  // button
  L('btn', b(27), b(1) + T, 2.8);
  $(C.btn, '.arr').style.transform = `translateX(${(trHover(t) * 8).toFixed(2)}px)`;
  // loader
  L('load', b(1), b(3), 2.8);
  { const x = t - b(1), ph = x / BEAT, len = .16 + .5 * Math.pow(Math.sin(Math.PI * clamp(ph / 2)), 2);
    const arc = $(C.load, '.arc'); arc.style.strokeDasharray = `${len} 1`;
    arc.style.transformOrigin = '84px 84px';
    arc.style.transform = `rotate(${-90 + x * 700 + 180 * easeInOut(ph - .5)}deg)`; }
  // check
  L('check', b(3), b(4), 3.0);
  $(C.check, '.ck').style.strokeDasharray = `${easeOut((t - b(3) - .1) / .28)} 1`;
  // island
  L('island', b(4), b(5), 2.6);
  { const x = t - b(4); C.island.querySelectorAll('.eq i').forEach((el, i) => {
      const beatEnv = Math.exp(-((x + 10 * BEAT) % BEAT) * 7), wv = [.55, 1, .7, .9, .45][i];
      el.style.height = (14 + 44 * wv * (.35 + .65 * beatEnv) + 5 * Math.sin(x * 9 + i * 1.7)).toFixed(2) + 'px'; }); }
  // player
  L('player', b(5), b(10), 2.0, 0, 0, [.13]);
  { const p = playerP(t), q = trPP(t);
    $(C.player, '.fill').style.width = (p * 100).toFixed(3) + '%';
    const kn = $(C.player, '.knob'); kn.style.left = (56 + 928 * p - 14) + 'px'; kn.style.transform = `scale(${trKnobS(t)})`;
    const tot = 212, sec = Math.round(p * tot), f = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $(C.player, '.tl').textContent = f(sec); $(C.player, '.tr').textContent = '−' + f(tot - sec);
    const d = PLAY.map((quad, qi) => 'M' + quad.map((pt, pi) => [mix(pt[0], PAUSE[qi][pi][0], q), mix(pt[1], PAUSE[qi][pi][1], q)].map(v => v.toFixed(2)).join(' ')).join('L') + 'Z').join('');
    const pp = $(C.player, '.pp'); pp.firstChild.setAttribute('d', d); pp.style.transform = `scale(${trPPs(t)})`; }
  // slider
  L('slider', b(10), b(14), 2.3);
  { fill.style.visibility = (t >= b(10) && t < b(14) + .1) ? 'visible' : 'hidden';
    fill.style.opacity = 1 - clamp((t - b(14)) / .09); // the player's black carries straight into the fill
    fill.style.height = h + 'px';
    fill.style.width = (sl.v * (w - sl.s) + (sl.v >= 1 ? sl.s : 0)) + 'px';
    $(C.slider, '.pct').textContent = Math.round(sl.v * 100) + '%';
    $(C.slider, '.w1').style.opacity = clamp((sl.v - .2) / .1); $(C.slider, '.w2').style.opacity = clamp((sl.v - .6) / .1); }
  // knob (toggle -> tab indicator)
  { const kv = vis(t, b(14), b(23), .06, .16), rowY = trRowY(t);
    const yOff = t >= b(16) ? rowY : 0;
    const lft = trKL(t), rgt = trKR(t), tp = trKT(t), sh = trKSh(t);
    knob.style.visibility = kv.o > .001 ? 'visible' : 'hidden';
    knob.style.opacity = kv.o; blur(knob, kv.bl / 3);
    knob.style.left = (w / 2 + lft - cx) + 'px'; knob.style.top = (h / 2 + tp + yOff - cy) + 'px';
    knob.style.width = (rgt - lft) + 'px'; knob.style.height = (-2 * tp) + 'px'; knob.style.borderRadius = (-tp) + 'px';
    knob.style.background = rgb(trKCol(t));
    knob.style.boxShadow = `0 1px 2px rgba(0,0,0,${(sh * .6).toFixed(3)}),0 3px 8px rgba(0,0,0,${sh.toFixed(3)})`;
    const S_T = 2.4, px = v => v * S_T;
    for (const k of ['tabsBg', 'tabsG', 'tabsW']) L(k, b(16), b(23), S_T, 0, rowY, [.17, .2]);
    C.tabsBg.style.opacity = (+C.tabsBg.style.opacity || 0) * trRowBg(t);
    const il = px(lft + 225), ir = 1080 - px(rgt + 225), it = px(tp + 35), ib = px(35 + tp);
    C.tabsW.style.clipPath = `inset(${it.toFixed(2)}px ${ir.toFixed(2)}px ${ib.toFixed(2)}px ${il.toFixed(2)}px round ${px(-tp).toFixed(2)}px)`; }
  // chart
  L('chart', b(19), b(23), 1.6, 0, 0, [.14, .24]);
  { $(C.chart, '.rv').setAttribute('width', (CH.x0 - 6 + drawP(t) * (CH.x1 - CH.x0 + 12)).toFixed(2));
    $(C.chart, '.num').textContent = Math.round(128 * easeOut((t - DRAW0) / (b(20) - DRAW0)));
    const ch = $(C.chart, '.chip'), cs = trChip(t); ch.style.opacity = clamp(cs); ch.style.transform = `scale(${(.8 + .2 * cs).toFixed(4)})`;
    const tv = vis(t, b(21), b(23), 0, .16), tx = trTipX(t);
    const hx = mix(CH.pts[4][0], CH.pts[5][0], tx), hy = mix(CH.pts[4][1], CH.pts[5][1], tx);
    C.chart.querySelectorAll('.dot').forEach((el, i) => {
      const hov = i === 4 ? tv.o * (1 - tx) : i === 5 ? tv.o * tx : 0;
      el.setAttribute('r', Math.max(0, 9 * step(t - dotTimes[i], 22, .86) + 5 * hov).toFixed(2)); });
    const gl = $(C.chart, '.guide'); gl.setAttribute('x1', hx); gl.setAttribute('x2', hx); gl.style.opacity = tv.o;
    const tip = $(C.chart, '.tip'); tip.style.opacity = tv.o;
    tip.style.transform = `translate(${clamp(hx - 150, 40, 780).toFixed(2)}px,${(hy - 132 + 8 * (1 - tv.o)).toFixed(2)}px)`;
    const A = vis(t, b(21), b(22), 0, .16, .08), B = vis(t, b(22), b(23), .08, .16);
    const ta = $(C.chart, '.tipa'), tb = $(C.chart, '.tipb');
    ta.style.opacity = A.o; blur(ta, A.bl / 2); tb.style.opacity = B.o; blur(tb, B.bl / 2); }
  // ⌘K
  L('key', b(23), b(24), 4.0);
  // palette: content top pinned to the palette top edge
  L('pal', b(24), b(26), 2.0, 0, palTop + wH('pal') / 2, [.2, .2]);
  { let q = ''; for (const [kt, s] of KEYS) if (t >= kt) q = s;
    const qs = $(C.pal, '.q'); if (qs.textContent !== q) qs.textContent = q;
    $(C.pal, '.ph').style.opacity = q ? 0 : 1;
    const typing = KEYS.some(([kt]) => t >= kt - .05 && t < kt + .35) || t >= b(25.5);
    $(C.pal, '.caret').style.opacity = typing ? 1 : ((Math.floor((t - b(24)) / BEAT) % 2) ? 0 : 1);
    const steps = ['', ...KEYS.map(k => k[1])], times = [b(24), ...KEYS.map(k => k[0])];
    C.pal.querySelectorAll('.it').forEach(el => {
      const i = +el.dataset.i, it = ITEMS[i], lo = it.t.toLowerCase();
      // row y: one spring per keystroke that changes this row's index among the visible rows
      let y = 0, prevIdx = null, gone = null;
      steps.forEach((s, si) => {
        if (s && !lo.includes(s)) { if (gone === null) gone = times[si]; return; }
        const idx = ITEMS.slice(0, i).filter(o => !s || o.t.toLowerCase().includes(s)).length;
        if (prevIdx === null) y = idx; else y += (idx - prevIdx) * step(t - times[si], ...SP.ui);
        prevIdx = idx; });
      el.style.top = (146 + y * 104) + 'px';
      const rv = vis(t, b(24) + i * .035, gone === null ? b(26) : gone, .2, .22, .08);
      el.style.opacity = rv.o; blur(el, rv.bl / 2);
      const hl = i === 0; el.style.background = hl ? '#F3F2EF' : 'transparent';
      $(el, '.hint').style.display = hl ? 'none' : ''; $(el, '.ent').style.display = hl ? '' : 'none';
      if (hl) $(el, '.ent').style.transform = `scale(${t > b(26) - .06 ? 1 - .12 * (1 - step(t - b(26) + .06, ...SP.ui)) : 1})`;
      const lbl = $(el, '.lbl'), k = q ? lo.indexOf(q) : -1;
      const html = k >= 0 ? `<span style="color:#8E8E93">${it.t.slice(0, k)}</span><span style="color:#111;font-weight:600">${it.t.slice(k, k + q.length)}</span><span style="color:#8E8E93">${it.t.slice(k + q.length)}</span>` : `<span style="color:#111">${it.t}</span>`;
      if (lbl.dataset.h !== html) { lbl.innerHTML = html; lbl.dataset.h = html; } }); }
  // toast
  L('toast', b(26), b(27), 2.4);

  // cursor in screen space
  const sx = 720 + trCX(t) * cam, sy = 720 + (trCY(t) - camY) * cam;
  cursor.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px) scale(${trCurS(t).toFixed(4)}) translate(-3px,-3px)`;
}

window.T = T; window.BEAT = BEAT; window.seek = seek;
window.EVENTS = { clicks, drags, keys: KEYS.map(k => k[0]).concat([b(26)]), hovers: [b(21), b(22)], toggle: b(15), success: [b(3), b(26)] };
const qp = new URLSearchParams(location.search);
if (qp.has('t')) seek(+qp.get('t'));
else if (qp.has('play')) { const t0 = performance.now(); const loop = () => { seek((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
else seek(0);
