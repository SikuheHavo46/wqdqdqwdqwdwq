'use strict';
// Layout is measured (cursor targets, bar items), so everything is built after the fonts are loaded.
window.READY = (async () => {
await Promise.all(['400', '600', '700'].flatMap(wt => [document.fonts.load(`${wt} 30px Inter`, 'Кк'), document.fonts.load(`${wt} 30px Inter`, 'Kk')]));
// ---------- timing ----------
const BPM = 120, BEAT = 60 / BPM, BARS = 24, T = BARS * 4 * BEAT; // 48 s
// Story time: one story unit = 1.5 music beats, so every hold is longer while events stay on the eighth-note grid.
const K = 1.5, b = n => n * BEAT * K;
const wrap = t => ((t % T) + T) % T;
const rel = (t, tc) => { let d = wrap(t) - wrap(tc); if (d > T / 2) d -= T; if (d < -T / 2) d += T; return d; };
const clamp = (x, a = 0, c = 1) => Math.min(c, Math.max(a, x));
const mix = (a, c, k) => a + (c - a) * k;
const mixC = (a, c, k) => a.map((v, i) => v + (c[i] - v) * k);
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);

// Closed-form step response of a damped spring (0 -> 1). zeta >= 0.85 keeps overshoot under ~1%.
function step(tau, w, z) {
  if (tau <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
const SP = { shape: [14, .87], cam: [8.5, 1], curX: [14, .9], curY: [11.5, .9], fast: [26, .9], lead: [26, .9], lag: [12, .88], ui: [20, .86], color: [30, 1], text: [22, .9] };

// A track is a sum of one spring per target change. Before the first event the value equals the last
// target, and the previous cycle's springs are included, so f(0) === f(T), velocity included.
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
// Enter/exit envelope. Exit (dOut) ends before a replacement's enter delay (dIn), so swaps never overlap.
function vis(t, tin, tout, dIn = .09, durIn = .22, dOut = .09) {
  const f = x => {
    const e = easeOut((x - tin - dIn) / durIn), q = clamp((x - tout) / dOut);
    return { o: e * (1 - q), bl: 12 * (1 - e) + 10 * q, s: .965 + .035 * e - .025 * q };
  };
  const t0 = wrap(t);
  return [f(t0), f(t0 + T), f(t0 - T)].reduce((m, x) => (x.o > m.o ? x : m));
}
const dip = (t, tc) => step(rel(t, tc) + .07, ...SP.fast) - step(rel(t, tc) - .05, ...SP.ui); // press 0..1..0
const pulse = (t, tc, d = .32) => { const x = rel(t, tc) / d; return x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0; };
const rgb = c => `rgb(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')})`;
const blur = (el, px) => { el.style.filter = px > .05 ? `blur(${px.toFixed(2)}px)` : 'none'; };
// Hidden elements drop their filter: stale filter/transform layers change how visible text is composited.
function show(el, v, k = 1) {
  const on = v.o > .001; el.style.visibility = on ? '' : 'hidden';
  el.style.opacity = on ? v.o.toFixed(4) : '0'; blur(el, on ? v.bl * k : 0);
}
const txt = (el, s) => { if (el.textContent !== s) el.textContent = s; };

// ---------- tokens (navprofr.ru computed styles) ----------
const ACC = [0, 113, 227], ACC_OFF = [158, 202, 243], WHT = [255, 255, 255], G2 = [210, 210, 215], SOFT = [232, 241, 252];
const SW = 4;
const IC = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4.5M9 13h.01M15 13h.01M9 16.5h6"/>',
  game: '<path d="M7 8h10a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6h-4A4 4 0 0 1 3 13v-1a4 4 0 0 1 4-4z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  spark: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  ext: '<path d="M14 5h5v5M19 5l-8 8M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
};
const icon = (n, px, sw = SW) =>
  `<svg class="ln" width="${px}" height="${px}" viewBox="0 0 24 24" stroke-width="${(sw * 24 / px).toFixed(3)}">${IC[n]}</svg>`;
const checkSvg = (px, sw, cls = 'ck') =>
  `<svg class="ln" width="${px}" height="${px}" viewBox="0 0 24 24" stroke-width="${(sw * 24 / px).toFixed(3)}"><path class="${cls}" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

// ---------- DOM ----------
const shape = document.getElementById('shape'), world = document.getElementById('world'), stage = document.getElementById('stage');
function add(parent, html, cls = 'c') {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d;
}
const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => [...root.querySelectorAll(sel)];

// Screens are laid out in screen px. A screen rests at camera scale S, so it renders 1:1 at rest.
const SCR = {
  hero: { W: 380, H: 120, R: 60, S: 1, bg: ACC, cx: -200, cy: 250, camY: 0 },
  ch: { W: 1000, H: 460, R: 64, S: 1.15, bg: ACC },
  reg: { W: 1040, H: 924, R: 56, S: 1, bg: WHT, top: -612 },
  regC: { W: 1040, H: 1224, R: 56, S: 1, bg: WHT, top: -612, content: 'reg' },
  load: { W: 150, H: 150, R: 75, S: 1.8, bg: ACC },
  ai: { W: 700, H: 150, R: 75, S: 1.5, bg: ACC },
  made: { W: 700, H: 150, R: 75, S: 1.5, bg: ACC },
  diag: { W: 1100, H: 1100, R: 56, S: 1, bg: WHT },
  calc: { W: 760, H: 150, R: 75, S: 1.5, bg: WHT },
  res: { W: 1100, H: 1060, R: 56, S: 1, bg: WHT },
  trials: { W: 1100, H: 1180, R: 56, S: 1, bg: WHT },
  modal: { W: 980, H: 1120, R: 56, S: 1, bg: WHT },
  ok: { W: 980, H: 180, R: 90, S: 1.3, bg: ACC },
  jobs: { W: 1100, H: 640, R: 56, S: 1, bg: WHT, top: -580 },
  jobsR: { W: 1100, H: 1160, R: 56, S: 1, bg: WHT, top: -580, content: 'jobs' },
  chat: { W: 1040, H: 1000, R: 56, S: 1, bg: WHT },
  prof: { W: 1100, H: 1100, R: 56, S: 1, bg: WHT },
};
const C = {}, CM = {};
function content(key, html) {
  const s = SCR[key], el = add(shape, `<div style="position:relative;width:${s.W}px;height:${s.H}px">${html}</div>`);
  el.style.width = s.W + 'px'; el.style.height = s.H + 'px'; C[key] = el; CM[key] = s; return el;
}

// ---- hero (text lives in the world, around the shape) ----
const heroText = add(world, `
  <div class="a lab" style="left:0;right:0;top:0;text-align:center;font-size:30px"><span class="hl0" style="display:inline-block">Портал профориентации</span></div>
  <div class="mask" style="left:0;right:0;top:40px;height:196px"><div class="hl1" style="text-align:center;font-size:176px;font-weight:700;letter-spacing:-7px;line-height:196px">Карьерный</div></div>
  <div class="mask" style="left:0;right:0;top:218px;height:196px"><div class="hl2" style="text-align:center;font-size:176px;font-weight:700;letter-spacing:-7px;line-height:196px;color:#0071e3">навигатор</div></div>
  <div class="a sub hl3" style="left:0;right:0;top:444px;text-align:center;font-size:34px">От интереса к первому рабочему месту — один профиль.</div>
  <div class="a pill pg hl4" style="left:710px;top:610px;width:380px;height:120px;font-size:36px">Смотреть путь</div>
  <div class="a hl5" style="left:0;right:0;top:772px;text-align:center;font-size:26px;color:#86868b;font-weight:500">Учёба · практика · карьера</div>`, 'c');
heroText.style.width = '1400px'; heroText.style.height = '880px';
content('hero', `<div class="pill" style="width:100%;height:100%;color:#fff;font-size:36px;gap:14px">Начать <span class="arr">${icon('arrow', 36)}</span></div>`);

// ---- chapter card ("Четыре спокойных шага" copy from the site) ----
const CHAP = [['Профиль', 'за минуту'], ['Сильные', 'направления'], ['Опыт', 'на практике'], ['Реальные', 'вакансии']];
content('ch', `<div style="width:100%;height:100%;color:#fff">
  <div class="a" style="left:88px;top:78px;font-size:32px;font-weight:600;opacity:.85;display:flex;height:40px;line-height:40px;white-space:pre">Шаг <span style="display:inline-block;height:40px;overflow:hidden"><span class="dg" style="display:block">${[0, 1, 2, 3, 4].map(d => `<span style="display:block;height:40px">${d}</span>`).join('')}</span></span> из 4</div>
  ${CHAP.map((l, k) => `<div class="a chh chh${k}" style="left:0;top:0;width:100%;height:100%">
    ${l.map((s, i) => `<div class="mask" style="left:88px;top:${146 + i * 112}px;height:120px;width:860px"><div class="ln${i}" style="font-size:108px;font-weight:700;letter-spacing:-4px;line-height:116px">${s}</div></div>`).join('')}</div>`).join('')}</div>`);

// ---- registration (anchored to its top edge: the form grows downward when "Создать аккаунт" adds fields) ----
content('reg', `
  <div class="a lab" style="left:88px;top:84px">Карьерный навигатор</div>
  <div class="a h1 tA" style="left:88px;top:124px">С возвращением</div>
  <div class="a h1 tB" style="left:88px;top:124px">Начните свой путь</div>
  <div class="a sub sA" style="left:88px;top:206px;width:864px">Войдите, чтобы продолжить с того места, где остановились.</div>
  <div class="a sub sB" style="left:88px;top:206px;width:864px">Создайте аккаунт: ваши цели и результаты будут сохраняться в профиле.</div>
  <div class="a" style="left:88px;top:316px;width:864px;height:84px;border-radius:20px;background:#f5f5f7">
    <div class="a knob" style="top:6px;height:72px;border-radius:15px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.08)"></div>
    <div class="a s0" style="left:0;width:432px;top:0;height:84px;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:600">Войти</div>
    <div class="a s1" style="left:432px;width:432px;top:0;height:84px;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:600">Создать аккаунт</div></div>
  <div class="a g0" style="left:88px;top:440px;width:864px"><div class="fl">Как к вам обращаться?</div><div class="inp f0" style="margin-top:14px"><span class="ph">Ваше имя</span><span class="v"></span><i class="caret"></i></div></div>
  <div class="a g1" style="left:88px;top:590px;width:864px"><div class="fl">Логин</div><div class="inp f1" style="margin-top:14px"><span class="ph">Например, alex_2026</span><span class="v"></span><i class="caret"></i></div></div>
  <div class="a g2" style="left:88px;top:740px;width:864px"><div class="fl">Пароль</div><div class="inp f2" style="margin-top:14px"><span class="ph"></span><span class="v" style="letter-spacing:5px"></span><i class="caret"></i></div></div>
  <div class="a g3" style="left:88px;top:890px;width:864px"><div class="fl">Я здесь как</div>
    <div style="display:flex;gap:12px;margin-top:14px">${['Участник', 'Наставник', 'Родитель'].map((s, i) => `<div class="chip r${i}" style="width:280px;height:84px">${s}</div>`).join('')}</div></div>
  <div class="a pill sb" style="left:88px;top:1052px;width:864px;height:92px;font-size:30px;color:#fff"><span class="a bA">Войти в профиль</span><span class="a bB">Создать аккаунт</span></div>`);

content('load', `<svg width="150" height="150" viewBox="0 0 150 150">
  <circle cx="75" cy="75" r="34" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8"/>
  <circle class="arc" cx="75" cy="75" r="34" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" pathLength="1"/></svg>`);
content('ai', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:20px;color:#fff">
  <span class="sp">${icon('spark', 50, 4)}</span><span style="font-size:40px;font-weight:700;letter-spacing:-.8px">Карьерный AI-помощник</span></div>`);
content('made', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:22px;color:#fff">
  ${checkSvg(54, 6)}<span style="font-size:42px;font-weight:700;letter-spacing:-.8px">Профиль создан</span></div>`);

// ---- diagnostics ----
const Q = [
  { n: 3, q: 'Что вам интереснее делать в свободное время?', o: ['Собирать и программировать гаджеты', 'Рисовать и придумывать дизайн', 'Помогать людям разобраться в проблеме', 'Организовывать события'] },
  { n: 4, q: 'Какая задача вам ближе?', o: ['Разобраться, как устроен механизм', 'Сделать красивую презентацию', 'Выслушать и поддержать друга', 'Собрать команду под проект'] }];
content('diag', `
  <div class="a lab" style="left:80px;top:84px">Диагностика</div>
  <div class="a h1" style="left:80px;top:124px">Интересы и склонности</div>
  <div class="a fl cnt" style="right:80px;top:96px;color:#86868b"></div>
  <div class="a" style="left:80px;top:222px;width:940px;height:12px;border-radius:6px;background:#e8e8ed;overflow:hidden"><div class="bar" style="height:100%;background:#0071e3;border-radius:6px"></div></div>
  ${Q.map((q, k) => `<div class="a qq q${k}" style="left:0;top:0;width:1100px;height:1100px">
    <div class="a qt" style="left:80px;top:282px;width:940px;font-size:44px;font-weight:650;letter-spacing:-1px;line-height:1.2">${q.q}</div>
    ${q.o.map((o, i) => `<div class="opt o${i}" style="top:${420 + i * 120}px"><div class="radio"><i></i></div>${o}</div>`).join('')}</div>`).join('')}
  <div class="a pill pg" style="left:80px;top:948px;width:220px;height:88px;font-size:28px">Назад</div>
  <div class="a pill pb nx" style="right:80px;top:948px;width:420px;height:88px;font-size:28px"><span class="a nA">Далее</span><span class="a nB">Показать результат</span></div>`);

content('calc', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:24px">
  <svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="21" fill="none" stroke="#e8e8ed" stroke-width="6"/>
  <circle class="arc" cx="27" cy="27" r="21" fill="none" stroke="#0071e3" stroke-width="6" stroke-linecap="round" pathLength="1"/></svg>
  <span style="font-size:38px;font-weight:650;letter-spacing:-.6px">Считаем результат…</span></div>`);

// ---- results (ТОП-3 names are demo data) ----
const TOP3 = [['IT и цифровые технологии', 92], ['Инженерия и робототехника', 78], ['Дизайн и медиа', 64]];
content('res', `
  <div class="a lab" style="left:80px;top:84px">Результаты</div>
  <div class="a h1" style="left:80px;top:124px">Сильные направления</div>
  <div class="a saved" style="right:80px;top:70px;height:56px;padding:0 24px;border-radius:30px;background:#e8f1fc;color:#0071e3;font-size:23px;font-weight:600;display:flex;align-items:center;gap:10px;transform-origin:100% 50%;white-space:nowrap">${icon('check', 26, 3)}Сохранено в профиле</div>
  <div class="a sub" style="left:80px;top:210px;width:940px">Порядок — по сумме ответов. Это гипотезы: проверьте их на профпробах.</div>
  ${TOP3.map(([n], i) => `<div class="a row row${i}" style="left:80px;top:${334 + i * 164}px;width:940px">
    <div style="font-size:23px;font-weight:600;color:#86868b">${i + 1} место</div>
    <div style="font-size:38px;font-weight:650;letter-spacing:-.8px;margin-top:6px">${n}</div>
    <div class="a sc s${i}" style="right:0;top:22px;font-size:44px;font-weight:700;letter-spacing:-1px;color:#0071e3">0</div>
    <div style="margin-top:18px;height:16px;border-radius:8px;background:#e8e8ed"><div class="rb r${i}" style="height:100%;border-radius:8px;background:#0071e3;opacity:${[1, .7, .45][i]};width:0"></div></div></div>`).join('')}
  <div class="a pill pb pick" style="left:80px;top:880px;width:470px;height:92px;font-size:29px">Подобрать профпробу</div>
  <div class="a pill pg" style="left:570px;top:880px;width:300px;height:92px;font-size:29px">Отчёт в PDF</div>`);

// ---- trials (real programmes of the academy listed on the site) ----
const TRIALS = [['3Д моделирование для компьютерных игр', 'cube'], ['Мобильная робототехника', 'robot'], ['Тестирование игрового ПО', 'game']];
content('trials', `
  <div class="a lab" style="left:80px;top:84px">Профессиональные пробы</div>
  <div class="a h1" style="left:80px;top:124px;font-size:56px;letter-spacing:-1.6px">Попробуйте профессию на практике</div>
  <div class="a sub" style="left:80px;top:202px">Запишитесь на профпробу прямо здесь.</div>
  <div class="a" style="left:80px;top:280px;display:flex;gap:14px">
    <div class="pill pb" style="height:64px;padding:0 30px;font-size:24px">По диагностике</div>
    <div class="pill pg" style="height:64px;padding:0 30px;font-size:24px;font-weight:500">Санкт-Петербург</div>
    <div class="pill pg" style="height:64px;padding:0 30px;font-size:24px;font-weight:500">Онлайн и очно</div></div>
  ${TRIALS.map(([n, ic], i) => `<div class="card tc${i}" style="top:${390 + i * 236}px;height:212px">
    <div style="width:124px;height:124px;border-radius:30px;background:#fff;display:flex;align-items:center;justify-content:center;margin:0 32px 0 30px;color:#0071e3;flex:none">${icon(ic, 60)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:32px;font-weight:650;letter-spacing:-.6px;line-height:1.2;width:480px">${n}</div>
      <div style="font-size:23px;color:#86868b;margin-top:10px;display:flex;align-items:center;gap:6px">${icon('pin', 24, 2.4)}Академия инженерных технологий · очно</div></div>
    <div class="pill pb go" style="width:210px;height:70px;font-size:25px;margin-right:32px;flex:none">Записаться</div></div>`).join('')}
  <div class="a" style="left:80px;top:1112px;font-size:21px;color:#86868b;white-space:nowrap">Источник проверен · СПб ГБПОУ «Академия инженерных технологий и управления»</div>`);

const SLOTS = ['12 окт · 11:00', '12 окт · 14:00', '19 окт · 11:00'];
content('modal', `
  <div class="a lab" style="left:88px;top:84px">Запись на профпробу</div>
  <div class="a h1" style="left:88px;top:124px;font-size:50px;letter-spacing:-1.4px;white-space:normal;width:804px">3Д моделирование для компьютерных игр</div>
  <div class="a sub" style="left:88px;top:258px;font-size:24px;width:804px">СПб ГБПОУ «Академия инженерных технологий и управления»</div>
  <div class="a fl" style="left:88px;top:350px">Дата и время</div>
  ${SLOTS.map((s, i) => `<div class="a chip sl${i}" style="left:${88 + i * 272}px;top:390px;width:256px;height:84px">${s}</div>`).join('')}
  <div class="a fl" style="left:88px;top:514px">ФИО участника</div>
  <div class="a inp" style="left:88px;top:552px;width:804px">Алина Смирнова</div>
  <div class="a fl" style="left:88px;top:666px">Школа</div>
  <div class="a inp" style="left:88px;top:704px;width:804px">ГБОУ СОШ № 123</div>
  <div class="a cb" style="left:88px;top:832px;width:44px;height:44px;border-radius:12px;border:2.5px solid #c7c7cc;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#fff">${checkSvg(28, 3.6)}</div>
  <div class="a" style="left:154px;top:828px;width:738px;font-size:24px;line-height:1.4;color:#424245">Согласен(на) на обработку персональных данных для записи на профпробу.</div>
  <div class="a pill pg" style="left:88px;top:950px;width:260px;height:92px;font-size:29px">Отмена</div>
  <div class="a pill sb" style="left:368px;top:950px;width:524px;height:92px;font-size:29px;color:#fff">Записаться</div>`);

content('ok', `<div style="width:100%;height:100%;display:flex;align-items:center;color:#fff">
  <div style="width:120px;height:120px;border-radius:60px;background:#fff;color:#0071e3;margin-left:30px;display:flex;align-items:center;justify-content:center;flex:none">${checkSvg(60, 7)}</div>
  <div style="margin-left:30px"><div style="font-size:46px;font-weight:700;letter-spacing:-1px">Вы записаны</div>
  <div class="oks" style="font-size:25px;opacity:.85;margin-top:4px;white-space:nowrap">12 октября, 11:00 · Академия инженерных технологий</div></div></div>`);

// ---- jobs (vacancies are demo data; the site searches the open «Работа России» catalogue) ----
const JOBS = [['Стажёр-разработчик игр', 'Студия «Пиксель» · Санкт-Петербург', 'от 40 000'], ['Стажёр 3D-художник', 'ООО «Цифровые решения» · Санкт-Петербург', 'от 35 000'], ['Стажёр службы поддержки', 'ИТ-компания «Нева» · удалённо', 'от 30 000']];
content('jobs', `
  <div class="a lab" style="left:80px;top:84px">Работа</div>
  <div class="a h1" style="left:80px;top:124px">Вакансии</div>
  <div class="a pill pg ask" style="right:80px;top:100px;height:70px;padding:0 28px;font-size:24px;gap:10px;color:#0071e3">${icon('spark', 28, 2.6)}Спросить помощника</div>
  <div class="a sub" style="left:80px;top:206px;width:940px">Ищите актуальные вакансии из открытых данных портала «Работа России».</div>
  <div class="a fl" style="left:80px;top:326px">Должность или ключевое слово</div>
  <div class="a inp kw" style="left:80px;top:364px;width:940px"><span class="ph">Например, дизайнер</span><span class="v"></span><i class="caret"></i></div>
  <div class="a fl" style="left:80px;top:476px">Код региона</div>
  <div class="a inp rg" style="left:80px;top:514px;width:440px"><span class="ph">78 — СПб, 47 — Ленобласть</span><span class="v"></span><i class="caret"></i></div>
  <div class="a pill find" style="left:540px;top:514px;width:480px;height:84px;font-size:28px;color:#fff;gap:14px"><span class="a fA">Найти вакансии</span><span class="a fB" style="display:flex;align-items:center;gap:14px">
    <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4"/><circle class="arc" cx="15" cy="15" r="11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" pathLength="1"/></svg>Ищем…</span></div>
  ${JOBS.map(([n, m, s], i) => `<div class="card jc${i}" style="top:${646 + i * 160}px;height:140px">
    <div style="width:88px;height:88px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;margin:0 26px 0 26px;color:#0071e3;flex:none">${icon('bag', 44)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:31px;font-weight:650;letter-spacing:-.6px">${n}</div><div style="font-size:22px;color:#86868b;margin-top:6px;white-space:nowrap">${m}</div></div>
    <div style="text-align:right;margin-right:30px"><div style="font-size:27px;font-weight:650;white-space:nowrap">${s} руб.</div>
      <div style="font-size:21px;font-weight:600;color:#0071e3;margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:flex-end;white-space:nowrap">Откликнуться ${icon('ext', 22, 2.4)}</div></div></div>`).join('')}`);

// ---- AI assistant ----
const CHIPS = ['Какие направления мне подходят?', 'Как подготовить резюме для первого трудоустройства?', 'Что добавить в портфолио?'];
const ANSWER = 'Начните с короткого резюме: учёба, интересы и ТОП-3 направлений из диагностики. Добавьте пройденную профпробу «3Д моделирование» — это уже реальный опыт. Следующий шаг: откликнитесь на стажировку и приложите портфолио.';
content('chat', `
  <div class="a" style="left:56px;top:48px;width:88px;height:88px;border-radius:44px;background:#0071e3;color:#fff;font-size:38px;font-weight:700;display:flex;align-items:center;justify-content:center">Н</div>
  <div class="a" style="left:168px;top:54px;font-size:34px;font-weight:700;letter-spacing:-.7px;white-space:nowrap">Карьерный AI-помощник</div>
  <div class="a" style="left:168px;top:100px;font-size:23px;color:#86868b;white-space:nowrap">Карьерный навигатор · AI</div>
  <div class="a pill pg me" style="right:56px;top:58px;height:66px;padding:0 26px;font-size:24px;gap:10px">${icon('user', 26, 2.6)}Мой профиль</div>
  <div class="a" style="left:0;right:0;top:170px;height:2px;background:#f0f0f2"></div>
  <div class="bub" style="left:56px;top:210px;width:720px;background:#f5f5f7">Помогу найти свой путь. Расскажите, что вам нравится — вместе найдём, с чего начать.</div>
  ${CHIPS.map((s, i) => `<div class="a pill pg cp cp${i}" style="left:56px;top:${392 + i * 84}px;height:66px;padding:0 28px;font-size:25px;font-weight:500">${s}</div>`).join('')}
  <div class="bub dots" style="left:56px;top:494px;background:#f5f5f7;display:flex;gap:10px;padding:30px 32px">${'<i style="display:block;width:14px;height:14px;border-radius:7px;background:#86868b"></i>'.repeat(3)}</div>
  <div class="bub ans" style="left:56px;top:494px;width:840px;background:#f5f5f7"><span class="tx"></span></div>
  <div class="a" style="left:56px;right:56px;top:868px;height:96px;border-radius:48px;background:#f5f5f7;display:flex;align-items:center;padding:0 16px 0 36px;box-sizing:border-box">
    <span style="font-size:28px;color:#a1a1a6;flex:1">О чём поговорим?</span>
    <div style="width:66px;height:66px;border-radius:33px;background:#c7c7cc;display:flex;align-items:center;justify-content:center;color:#fff">${icon('up', 32, 3.4)}</div></div>`);

// ---- profile finale ----
const STEPS = ['Диагностика', 'Профессиональная проба', 'Маршрут', 'Первый отклик'];
content('prof', `
  <div class="a" style="left:80px;top:80px;width:120px;height:120px;border-radius:60px;background:#0071e3;color:#fff;font-size:54px;font-weight:700;display:flex;align-items:center;justify-content:center">А</div>
  <div class="a lab" style="left:228px;top:92px">Личный кабинет</div>
  <div class="a h1" style="left:228px;top:128px;font-size:58px">Алина</div>
  <div class="a" style="right:80px;top:112px;height:60px;padding:0 24px;border-radius:30px;background:#f5f5f7;font-size:23px;font-weight:600;display:flex;align-items:center;white-space:nowrap">Участник · Школьник</div>
  <div class="a sub" style="left:80px;top:236px">Ваши интересы, достижения и следующий шаг — в одном месте.</div>
  <div class="a fl" style="left:80px;top:318px">Прогресс</div><div class="a fl pc" style="right:80px;top:318px;color:#0071e3"></div>
  <div class="a" style="left:80px;top:360px;width:940px;height:12px;border-radius:6px;background:#e8e8ed;overflow:hidden"><div class="pf" style="height:100%;background:#0071e3;border-radius:6px"></div></div>
  ${STEPS.map((s, i) => `<div class="a st st${i}" style="left:${80 + i * 235}px;top:404px;width:222px">
    <div class="sd" style="width:64px;height:64px;border-radius:32px;border:3px solid #d2d2d7;box-sizing:border-box;position:relative;color:#fff">
      <span class="a nn" style="left:0;top:0;width:58px;height:58px;display:flex;align-items:center;justify-content:center;font-size:25px;font-weight:700;color:#86868b">${i + 1}</span>
      <span class="a" style="left:12px;top:12px">${checkSvg(34, 3.6)}</span></div>
    <div style="margin-top:14px;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-.3px;width:210px">${s}</div></div>`).join('')}
  <div class="a pbox" style="left:80px;top:600px;width:940px;height:420px;border-radius:36px;background:#f5f5f7;transform-origin:50% 0"></div>
  <div class="a lab pb0" style="left:124px;top:646px">Карьерный навигатор</div>
  <div class="mask" style="left:124px;top:690px;height:100px;width:860px"><div class="pl1" style="font-size:88px;font-weight:700;letter-spacing:-3.4px;line-height:100px">Один профиль.</div></div>
  <div class="mask" style="left:124px;top:784px;height:100px;width:860px"><div class="pl2" style="font-size:88px;font-weight:700;letter-spacing:-3.4px;line-height:100px;color:#0071e3">Весь путь.</div></div>
  <div class="a sub pb3" style="left:124px;top:904px;width:560px;font-size:25px">Семь блоков связаны с вашим цифровым профилем — от диагностики до вакансии.</div>
  <div class="a pill pb pb4" style="right:124px;top:924px;height:68px;padding:0 30px;font-size:26px">navprofr.ru</div>`);

// ---- step bar (screen space): the site header morphs into the four-step progress ----
const bar = add(stage, `
  <div class="bl bA" style="gap:30px;padding:0 10px 0 16px">
    <div style="display:flex;align-items:center;gap:14px"><div style="width:50px;height:50px;border-radius:15px;background:#0071e3;color:#fff;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center">КН</div>
      <span style="font-size:24px;font-weight:700;letter-spacing:-.4px">Карьерный навигатор</span></div>
    <span style="font-size:23px;color:#6e6e73;font-weight:500;margin-left:24px">О проекте</span><span style="font-size:23px;color:#6e6e73;font-weight:500">Путь</span><span style="font-size:23px;color:#6e6e73;font-weight:500">Блоки</span>
    <div class="pill pb" style="height:58px;padding:0 28px;font-size:23px;margin-left:18px">Войти</div></div>
  <div class="bl bB" style="padding:0 8px">
    <div class="bw" style="display:flex;position:relative">${['Вход', 'Диагностика', 'Пробы', 'Работа'].map((s, i) => `<div class="bi i${i}"><div class="bn"><span>${i + 1}</span>${checkSvg(40, 3.2).replace('<svg', '<svg style="padding:9px;box-sizing:border-box"')}</div>${s}</div>`).join('')}</div>
    <div class="bk a" style="top:8px;height:64px;border-radius:32px;background:#0071e3"></div>
    <div class="bwc a" style="left:8px;top:0;height:80px;display:flex;align-items:center;color:#fff">${['Вход', 'Диагностика', 'Пробы', 'Работа'].map((s, i) => `<div class="bi"><div class="bn" style="background:rgba(255,255,255,.2);color:#fff"><span>${i + 1}</span>${checkSvg(40, 3.2).replace('<svg', '<svg style="padding:9px;box-sizing:border-box"')}</div>${s}</div>`).join('')}</div></div>`, '');
bar.id = 'bar';

const cursor = add(stage, `<svg width="46" height="60" viewBox="0 0 23 30"><path d="M1.5 1.5v22.2l5.6-5.1 3.6 8.4 3.9-1.7-3.6-8.2 7.6-.3z" fill="#1d1d1f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`, '');
cursor.id = 'cursor';

// ---------- timeline (beats) ----------
const SEQ = [[2, 'ch'], [4, 'reg'], [5, 'regC'], [11, 'load'], [12, 'made'], [14, 'ch'], [16, 'diag'], [20, 'calc'], [21, 'res'],
  [25, 'ch'], [27, 'trials'], [29, 'modal'], [32, 'ok'], [34, 'ch'], [36, 'jobs'], [41, 'jobsR'], [43, 'ai'], [44.5, 'chat'], [50.5, 'prof'], [58, 'hero']];
const CHAP_AT = [2, 14, 25, 34];
const ckey = k => SCR[k].content || k;
const WINS = {};
SEQ.forEach(([bb, k], i) => {
  const nb = i + 1 < SEQ.length ? SEQ[i + 1][0] : SEQ[0][0] + 64, key = ckey(k), w = (WINS[key] = WINS[key] || []);
  const last = w[w.length - 1];
  if (last && Math.abs(last[1] - b(bb)) < 1e-9) last[1] = b(nb); else w.push([b(bb), b(nb)]);
});

function dimsOf(k) {
  const s = SCR[k], h = s.H / s.S;
  const cy = s.top !== undefined ? s.top + h / 2 : (s.cy || 0);
  return { w: s.W / s.S, h, r: s.R / s.S, bg: s.bg, S: s.S, cx: s.cx || 0, cy, camY: s.camY !== undefined ? s.camY : cy };
}
const dims = SEQ.map(([bb, k]) => [b(bb), dimsOf(k)]);
// White -> blue recolours immediately: the shrinking card reads as becoming the button instead of an empty white frame.
const COLOR_DELAY = {};
const trW = track(dims.map(([t, d]) => [t, d.w]));
const trH = track(dims.map(([t, d]) => [t, d.h]));
const trR = track(dims.map(([t, d]) => [t, d.r]));
const trCx = track(dims.map(([t, d]) => [t, d.cx]));
const trCy = track(dims.map(([t, d]) => [t, d.cy]));
const trBg = track(dims.map(([t, d], i) => [t + (COLOR_DELAY[SEQ[i][1]] || 0), d.bg]), SP.color);

// content-local px -> world coordinates (time independent: anchored screens keep a fixed top edge)
function toWorld(key, x, y) {
  const s = SCR[key];
  return [(x - s.W / 2) / s.S + (s.cx || 0), s.top !== undefined ? s.top + y / s.S : (s.cy || 0) + (y - s.H / 2) / s.S];
}
function local(key, sel, fx = .5, fy = .5) {
  const root = C[key]; let el = $(root, sel), x = 0, y = 0;
  const w = el.offsetWidth, h = el.offsetHeight;
  while (el && el !== root) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  return [x + w * fx, y + h * fy];
}
const at = (key, sel, fx, fy) => toWorld(key, ...local(key, sel, fx, fy));

// ---------- camera: state framing + focus shots ----------
const SHOTS = [ // [beat, scale, x, y]
  [6, 1.3, 0, at('reg', '.f0')[1]], [7, 1.3, 0, at('reg', '.f1')[1]], [8.5, 1.3, 0, at('reg', '.f2')[1]], [9.7, 1, 0, 0, 'rel'],
  [22, 1.24, 0, at('res', '.row1', .5, .5)[1]], [24, 1, 0, 0, 'rel'],
  [37, 1.28, 0, (at('jobs', '.kw')[1] + at('jobs', '.rg')[1]) / 2], [39.8, 1, 0, 0, 'rel'],
  [54, 1.26, 0, at('prof', '.pl1', .5, 1)[1] + 20], [57, 1, 0, 0, 'rel']];
function stateAt(beat) { let k = SEQ[SEQ.length - 1][1]; for (const [bb, kk] of SEQ) if (bb <= beat) k = kk; return dimsOf(k); }
const camEv = dims.map(([t, d]) => [t, [d.S, 0, d.camY]]).concat(SHOTS.map(([bb, s, x, y, m]) => {
  const d = stateAt(bb); return [b(bb), m === 'rel' ? [d.S, 0, d.camY] : [s, x, y]];
}));
const trCam = track(camEv, SP.cam);
const trFocus = track(SHOTS.map(([bb, , , , m]) => [b(bb), m === 'rel' ? 0 : 1, SP.cam]));

// ---------- clicks, typing, cursor ----------
const typed = (s, t0, dt) => t => s.slice(0, clamp(Math.floor((wrap(t) - t0) / dt) + 1, 0, s.length));
const TYPE = {
  name: { s: 'Алина', t0: b(6.25), dt: .11 }, login: { s: 'alina_2026', t0: b(7.25), dt: .085 },
  pass: { s: '••••••••••••', t0: b(8.75), dt: .05 }, kw: { s: 'Стажировка', t0: b(37.25), dt: .085 }, rg: { s: '78', t0: b(38.75), dt: .1 } };
for (const k in TYPE) TYPE[k].f = typed(TYPE[k].s, TYPE[k].t0, TYPE[k].dt);
const keyTimes = Object.values(TYPE).flatMap(o => [...o.s].map((_, i) => o.t0 + i * o.dt));

const CLICKS = { 2: ['hero', '.pill', .8, .66], 5: ['reg', '.s1', .78, .62], 6: ['reg', '.f0', .86, .6], 7: ['reg', '.f1', .86, .6], 8.5: ['reg', '.f2', .86, .6],
  10: ['reg', '.r0', .8, .64], 11: ['reg', '.sb', .78, .64], 17: ['diag', '.q0 .o0', .86, .6], 18: ['diag', '.nx', .82, .64], 19: ['diag', '.q1 .o0', .86, .6],
  20: ['diag', '.nx', .84, .64], 25: ['res', '.pick', .82, .64], 29: ['trials', '.tc0 .go', .8, .64], 30: ['modal', '.sl0', .8, .64], 31: ['modal', '.cb', .62, .7],
  32: ['modal', '.sb', .8, .64], 37: ['jobs', '.kw', .88, .6], 38.5: ['jobs', '.rg', .9, .6], 40: ['jobs', '.find', .84, .64], 43: ['jobs', '.ask', .84, .66],
  45.5: ['chat', '.cp1', .86, .64], 50.5: ['chat', '.me', .8, .66] };
const clicks = Object.keys(CLICKS).map(Number).sort((p, q) => p - q);
const P = {}; for (const c of clicks) P[c] = at(...CLICKS[c]);
const hovS = [330, 272]; // "Смотреть путь" sits outside the shape, right of «Начать»
const CUR = [[b(63.1), hovS], [b(0.5), P[2]], [b(2.6), [300, 160]], [b(3.6), [320, 120]]];
let prevT = b(3.6);
for (const c of clicks) {
  if (c === 2) continue;
  CUR.push([Math.max(prevT + .12, b(c) - .38), P[c]]);
  prevT = b(c);
}
CUR.push([b(11.55), [120, 110]], [b(12.8), [240, 90]], [b(14.6), [330, 230]], [b(20.6), [300, 120]], [b(21.8), [330, 40]], [b(27.4), at('trials', '.tc0', .56, .5)],
  [b(32.6), [340, 130]], [b(34.6), [330, 250]], [b(40.6), [300, 40]], [b(41.7), at('jobs', '.jc0', .6, .5)], [b(43.4), [80, 60]], [b(46.1), [300, 120]], [b(47.7), [420, -20]],
  [b(51.2), [360, 200]], [b(53), [420, 300]], [b(55.5), [440, 420]], [b(58.2), [760, 640]], [b(61.6), [620, 560]]);
const trCX = track(CUR.map(([t, p]) => [t, p[0]]), SP.curX);
const trCY = track(CUR.map(([t, p]) => [t, p[1]]), SP.curY);
const trCurS = track(clicks.map(b).flatMap(t => [[t - .07, .84, SP.fast], [t + .05, 1, SP.ui]]));
const SHAPE_PRESS = [2, 11, 20, 32].map(b);
const trPress = track(SHAPE_PRESS.flatMap(t => [[t - .07, .97, SP.fast], [t + .06, 1, SP.ui]]));

// ---------- per-screen tracks ----------
const PRIME = b(0.5); // resets happen while a screen is hidden, so nothing springs in from a stale target
const trHovS = track([[b(63), 1, SP.ui], [b(0.3), 0, SP.ui]]), trHovH = track([[b(0.9), 1, SP.ui], [b(2.2), 0, SP.ui]]);
const trDigit = track([[b(2), 1, SP.text], [b(14), 2, SP.text], [b(25), 3, SP.text], [b(34), 4, SP.text], [b(59), 0, SP.text]]);
const trSegL = track([[PRIME, 6], [b(5), 438, SP.lag]]), trSegR = track([[PRIME, 426], [b(5), 858, SP.lead]]);
const trIns = track([[PRIME, 0], [b(5), 1]]);
const trRole = track([[PRIME, 0], [b(10), 1, SP.ui]]);
const trSubmit = track([[PRIME, ACC_OFF], [b(10.05), ACC]], SP.ui);
const trBar = track([[PRIME, 2 / 12], [b(16.2), 3 / 12], [b(18), 4 / 12], [b(20), 5 / 12]], SP.ui);
const trSel0 = track([[PRIME, 0], [b(17), 1, SP.ui]]), trSel1 = track([[PRIME, 0], [b(19), 1, SP.ui]]);
const trBadge = track([[PRIME, 0], [b(23), 1, SP.ui]]);
const trHovT = track([[PRIME, 0], [b(27.9), 1, SP.ui], [b(29), 0, SP.ui]]);
const trSlot = track([[PRIME, 0], [b(30), 1, SP.ui]]), trCb = track([[PRIME, 0], [b(31), 1, SP.ui]]);
const trMsb = track([[PRIME, ACC_OFF], [b(31.05), ACC]], SP.ui);
const trFindC = track([[PRIME, ACC_OFF], [b(38.8), ACC]], SP.ui);
const trHovJ = track([[PRIME, 0], [b(42), 1, SP.ui], [b(43), 0, SP.ui]]);
const trFly = track([[PRIME, 0], [b(45.5), 1, SP.ui]]);
const DONE = [51.3, 51.8, 52.3, 52.8].map(b);

// step bar
const bA = $(bar, '.bA'), bB = $(bar, '.bB'), bk = $(bar, '.bk'), bwc = $(bar, '.bwc');
const items = $$(bar, '.bw .bi').map(el => [el.offsetLeft + 8, el.offsetLeft + 8 + el.offsetWidth]);
const wA = bA.offsetWidth, wB = bB.offsetWidth;
const trBarW = track([[b(2.5), wB], [b(58), wA]]);
const KN = [[b(59), 0, 0], [b(14), 1, 1], [b(25), 2, 1], [b(34), 3, 1], [b(53), -1, 1]]; // [t, item | -1 = all, direction]
const kx = i => (i < 0 ? [items[0][0], items[3][1]] : items[i]);
const trKL = track(KN.map(([t, i, d]) => [t, kx(i)[0], i < 0 ? SP.lead : d > 0 ? SP.lag : SP.ui]));
const trKR = track(KN.map(([t, i, d]) => [t, kx(i)[1], i < 0 ? SP.lag : d > 0 ? SP.lead : SP.ui]));
const BAR_DONE = [13, 23, 33, 42].map(b);

// ---------- render ----------
function place(key, t, g, opt) {
  const el = C[key], s = CM[key];
  const v = WINS[key].map(([a, c]) => vis(t, a, c, ...(opt || [.06, .2]), .06)).reduce((m, x) => (x.o > m.o ? x : m));
  el.style.display = v.o > .001 ? '' : 'none'; // no leftover layers from hidden screens: every frame depends on t only
  if (v.o <= .001) return v;
  el.style.opacity = v.o.toFixed(4); blur(el, v.bl);
  const k = v.s / s.S;
  el.style.transform = s.top !== undefined
    ? `translate(${g.w / 2}px,0px) scale(${k}) translate(${-s.W / 2}px,0px)`
    : `translate(${g.w / 2}px,${g.h / 2}px) scale(${k}) translate(${-s.W / 2}px,${-s.H / 2}px)`;
  return v;
}
const setChip = (el, k) => { el.style.borderColor = rgb(mixC(G2, ACC, k)); el.style.background = rgb(mixC(WHT, SOFT, k)); el.style.color = k > .5 ? '#0071e3' : '#1d1d1f'; };
function typeInto(inp, o, t, t1) {
  const s = o.f(t), x = wrap(t), active = x >= o.t0 - .3 && x < t1;
  txt($(inp, '.v'), s); $(inp, '.ph').style.display = s ? 'none' : '';
  const typing = x >= o.t0 - .05 && x < o.t0 + o.s.length * o.dt + .1;
  $(inp, '.caret').style.opacity = active && (typing || (x - o.t0) % 1 < .55) ? 1 : 0;
  inp.style.borderColor = active ? 'rgba(0,113,227,.6)' : 'transparent';
  inp.style.background = active ? '#fff' : '#f5f5f7';
  inp.style.boxShadow = active ? '0 0 0 5px rgba(0,113,227,.12)' : 'none';
}
function spin(arc, x) {
  const len = .2 + .45 * Math.pow(Math.sin(Math.PI * clamp(x / 1.2)), 2);
  arc.style.strokeDasharray = `${len} 1`; arc.style.transformBox = 'fill-box'; arc.style.transformOrigin = 'center';
  arc.style.transform = `rotate(${-90 + x * 520}deg)`;
}
const press = (el, t, tc, amt = .04) => { el.style.transform = `scale(${1 - amt * dip(t, tc)})`; };
const rise = (el, t, t0, dist = 1.1) => { const k = step(rel(t, t0), ...SP.text); el.style.transform = `translateY(${((1 - k) * dist * 100).toFixed(2)}%)`; };
const draw = (el, t, t0, d = .28) => { el.style.strokeDasharray = `${easeOut(rel(t, t0) / d)} 1`; };

function seek(tRaw) {
  const t = wrap(tRaw);
  const w = trW(t), h = trH(t), cx = trCx(t), cy = trCy(t);
  let ww = w;
  const inHero = t >= b(58) || t < b(2.1);
  if (inHero) ww += 16 * trHovH(t);
  const r = Math.min(trR(t), h / 2, ww / 2);
  shape.style.width = ww + 'px'; shape.style.height = h + 'px';
  shape.style.left = (cx - ww / 2) + 'px'; shape.style.top = (cy - h / 2) + 'px';
  shape.style.borderRadius = r + 'px'; shape.style.background = rgb(trBg(t));
  shape.style.transform = `scale(${trPress(t)})`;
  const g = { w: ww, h };

  // camera: soft-min against "shape fits the frame" unless a focus shot is active
  const [c0, camX, camY] = trCam(t), fw = clamp(trFocus(t));
  const fit = Math.min(1360 / ww, 1270 / h), K = .05;
  const cam = mix(-K * Math.log(Math.exp(-c0 / K) + Math.exp(-fit / K)), c0, fw);
  world.style.transform = `translate(720px,764px) scale(${cam}) translate(${-camX}px,${-camY}px)`;

  // hero
  { const hv = WINS.hero.map(([a, c]) => vis(t, a, c, .05, .3, .12)).reduce((m, x) => (x.o > m.o ? x : m));
    heroText.style.display = hv.o > .001 ? '' : 'none';
    heroText.style.opacity = hv.o; blur(heroText, hv.o < 1 && t < b(10) ? hv.bl : 0);
    heroText.style.transform = `translate(-700px,-420px)`;
    const t0 = b(58);
    const fade = (el, tt) => { const k = step(rel(t, tt), ...SP.text), done = k > .999;
      // settled text drops opacity/transform entirely, so its rasterisation doesn't depend on the preceding animation
      el.style.opacity = done ? '' : k; el.style.transform = done ? '' : `translateY(${(1 - k) * 24}px)`; };
    fade($(heroText, '.hl0'), t0 + .05); rise($(heroText, '.hl1'), t, t0 + .12); rise($(heroText, '.hl2'), t, t0 + .38);
    fade($(heroText, '.hl3'), b(59.4)); fade($(heroText, '.hl5'), b(61));
    const s4 = $(heroText, '.hl4'), k4 = step(rel(t, b(60)), ...SP.ui), hs = trHovS(t);
    s4.style.opacity = k4 > .999 ? '' : k4; s4.style.transform = k4 > .999 ? '' : `scale(${.9 + .1 * k4})`; s4.style.background = rgb(mixC(WHT, [245, 245, 247], hs)); s4.style.borderColor = rgb(mixC(G2, [134, 134, 139], hs)); }
  place('hero', t, g, [.06, .2]);
  $(C.hero, '.arr').style.transform = `translateX(${(trHovH(t) * 8).toFixed(2)}px)`;

  // chapter cards
  if (place('ch', t, g, [.06, .2]).o > 0) {
    $(C.ch, '.dg').style.transform = `translateY(${(-40 * trDigit(t)).toFixed(2)}px)`;
    CHAP.forEach((_, k) => {
      const el = $(C.ch, '.chh' + k), a = b(CHAP_AT[k]);
      const on = rel(t, a) > -.01 && rel(t, a) < b(2) + .1;
      el.style.visibility = on ? '' : 'hidden';
      if (on) { rise($(el, '.ln0'), t, a + .1); rise($(el, '.ln1'), t, a + .2); }
    });
  }

  // registration
  if (place('reg', t, g).o > 0) {
    const R = C.reg, ins = trIns(t);
    show($(R, '.tA'), vis(t, -1, b(5))); show($(R, '.tB'), vis(t, b(5), T + 1));
    show($(R, '.sA'), vis(t, -1, b(5))); show($(R, '.sB'), vis(t, b(5), T + 1));
    show($(R, '.bA'), vis(t, -1, b(5))); show($(R, '.bB'), vis(t, b(5), T + 1));
    const kn = $(R, '.knob'), l = trSegL(t), rr = trSegR(t); kn.style.left = l + 'px'; kn.style.width = (rr - l) + 'px';
    const k = clamp((t - b(5)) / .16); $(R, '.s0').style.color = rgb(mixC([29, 29, 31], [134, 134, 139], k)); $(R, '.s1').style.color = rgb(mixC([134, 134, 139], [29, 29, 31], k));
    press($(R, '.s1'), t, b(5), .05);
    const g0 = vis(t, b(5), T + 1, .12, .26); show($(R, '.g0'), g0, .5); $(R, '.g0').style.transform = `translateY(${(1 - g0.o) * -16}px)`;
    const g3 = vis(t, b(5), T + 1, .2, .26); show($(R, '.g3'), g3, .5);
    $(R, '.g1').style.transform = `translateY(${(-150 * (1 - ins)).toFixed(2)}px)`;
    $(R, '.g2').style.transform = `translateY(${(-150 * (1 - ins)).toFixed(2)}px)`;
    $(R, '.g3').style.transform = `translateY(${(-150 * (1 - ins)).toFixed(2)}px)`;
    typeInto($(R, '.f0'), TYPE.name, t, b(7)); typeInto($(R, '.f1'), TYPE.login, t, b(8.5)); typeInto($(R, '.f2'), TYPE.pass, t, b(9.8));
    ['.r0', '.r1', '.r2'].forEach((s, i) => setChip($(R, s), i ? 0 : trRole(t)));
    press($(R, '.r0'), t, b(10), .05);
    const sb = $(R, '.sb'); sb.style.background = rgb(trSubmit(t));
    sb.style.transform = `translateY(${(-300 * (1 - ins)).toFixed(2)}px) scale(${1 - .03 * dip(t, b(11))})`;
  }
  if (place('load', t, g, [.06, .18]).o > 0) spin($(C.load, '.arc'), t - b(11));
  if (place('ai', t, g, [.06, .18]).o > 0) $(C.ai, '.sp').style.transform = `rotate(${(90 * step(t - b(43) - .1, ...SP.ui)).toFixed(2)}deg) scale(${1 + .15 * pulse(t, b(43) + .1, .4)})`;
  if (place('made', t, g, [.06, .18]).o > 0) draw($(C.made, '.ck'), t, b(12) + .15);

  // diagnostics
  if (place('diag', t, g).o > 0) {
    const D = C.diag;
    txt($(D, '.cnt'), `Вопрос ${t < b(18) ? 3 : 4} из 12`);
    $(D, '.bar').style.width = (trBar(t) * 100).toFixed(3) + '%';
    [0, 1].forEach(q => {
      const tin = q ? b(18) : -1, tout = q ? T + 1 : b(18);
      show($(D, `.q${q} .qt`), vis(t, tin, tout, .09, .24));
      $$(D, `.q${q} .opt`).forEach((o, i) => {
        const v = vis(t, q ? tin + .05 * i : tin, tout, .1, .24); show(o, v, .5);
        const sel = i === 0 ? (q ? trSel1(t) : trSel0(t)) : 0;
        o.style.transform = `translateY(${((1 - v.o) * 16 * q).toFixed(2)}px) scale(${1 - .015 * dip(t, q ? b(19) : b(17)) * (i === 0)})`;
        o.style.borderColor = rgb(mixC([232, 232, 237], ACC, sel)); o.style.background = rgb(mixC(WHT, [240, 246, 253], sel));
        $(o, '.radio').style.borderColor = sel > .5 ? '#0071e3' : '#c7c7cc'; $(o, '.radio i').style.transform = `scale(${sel})`;
      });
    });
    show($(D, '.nA'), vis(t, -1, b(18.3))); show($(D, '.nB'), vis(t, b(18.3), T + 1, .02, .16));
    const nx = $(D, '.nx'); nx.style.transform = `scale(${1 - .04 * (dip(t, b(18)) + dip(t, b(20)))})`;
  }
  if (place('calc', t, g, [.06, .18]).o > 0) spin($(C.calc, '.arc'), t - b(20));

  // results
  if (place('res', t, g).o > 0) {
    TOP3.forEach(([, v], i) => {
      const p = easeOut((t - b(21.3) - i * .2) / .95);
      $(C.res, '.r' + i).style.width = (v * p).toFixed(2) + '%';
      txt($(C.res, '.s' + i), String(Math.round(v * p)));
      const rv = vis(t, b(21) + i * .08, T + 1, .12, .26); show($(C.res, '.row' + i), rv, .5);
    });
    const sv = trBadge(t), sa = $(C.res, '.saved'); sa.style.opacity = clamp(sv); sa.style.transform = `scale(${.8 + .2 * sv})`;
    press($(C.res, '.pick'), t, b(25));
  }

  // trials
  if (place('trials', t, g).o > 0) {
    const hv = trHovT(t);
    TRIALS.forEach((_, i) => {
      const c = $(C.trials, '.tc' + i), v = vis(t, b(27) + .08 + i * .08, T + 1, .1, .28); show(c, v, .5);
      c.style.transform = `translateY(${((1 - v.o) * 28 - (i === 0 ? 5 * hv : 0)).toFixed(2)}px)`;
      c.style.background = i === 0 ? rgb(mixC([245, 245, 247], [236, 240, 247], hv)) : '#f5f5f7';
    });
    press($(C.trials, '.tc0 .go'), t, b(29), .05);
  }
  // modal
  if (place('modal', t, g).o > 0) {
    const M = C.modal;
    ['.sl0', '.sl1', '.sl2'].forEach((s, i) => setChip($(M, s), i ? 0 : trSlot(t)));
    press($(M, '.sl0'), t, b(30), .05);
    const k = trCb(t), cb = $(M, '.cb'); cb.style.background = rgb(mixC(WHT, ACC, k)); cb.style.borderColor = k > .3 ? '#0071e3' : '#c7c7cc';
    cb.style.transform = `scale(${1 - .12 * dip(t, b(31))})`;
    draw($(cb, '.ck'), t, b(31) + .04, .22);
    const sb = $(M, '.sb'); sb.style.background = rgb(trMsb(t)); sb.style.transform = `scale(${1 - .03 * dip(t, b(32))})`;
  }
  if (place('ok', t, g, [.06, .18]).o > 0) { draw($(C.ok, '.ck'), t, b(32) + .18); const sv = vis(t, b(32.5), T + 1, 0, .26); show($(C.ok, '.oks'), sv, .4); }

  // jobs
  if (place('jobs', t, g).o > 0) {
    const J = C.jobs;
    typeInto($(J, '.kw'), TYPE.kw, t, b(38.5)); typeInto($(J, '.rg'), TYPE.rg, t, b(39.8));
    const f = $(J, '.find'); f.style.background = rgb(trFindC(t)); f.style.transform = `scale(${1 - .03 * dip(t, b(40))})`;
    show($(J, '.fA'), vis(t, b(41), b(40.05) + T, 0, .2)); show($(J, '.fB'), vis(t, b(40.05), b(41), 0, .14));
    spin($(J, '.fB .arc'), t - b(40));
    JOBS.forEach((_, i) => {
      const c = $(J, '.jc' + i), v = vis(t, b(41) + .06 + i * .1, T + 1, .1, .28); show(c, v, .5);
      const hv = i === 0 ? trHovJ(t) : 0;
      c.style.transform = `translateY(${((1 - v.o) * 30 - 5 * hv).toFixed(2)}px)`;
      c.style.background = rgb(mixC([245, 245, 247], [236, 240, 247], hv));
    });
    press($(J, '.ask'), t, b(43), .05);
  }

  // chat
  if (place('chat', t, g).o > 0) {
    const H = C.chat, fly = trFly(t), c1 = $(H, '.cp1');
    CHIPS.forEach((_, i) => {
      const el = $(H, '.cp' + i), v = vis(t, b(44.5) + .16 + i * .07, i === 1 ? T + 1 : b(45.5), .1, .24, .12);
      show(el, v, .5); if (i !== 1) el.style.transform = `translateY(${(1 - v.o) * 14}px)`;
    });
    const dx = 1040 - 56 - c1.offsetWidth - 56;
    c1.style.transform = `translateX(${(dx * fly).toFixed(2)}px) scale(${1 - .04 * dip(t, b(45.5))})`;
    c1.style.background = rgb(mixC(WHT, ACC, clamp(fly * 1.2))); c1.style.color = fly > .45 ? '#fff' : '#1d1d1f';
    c1.style.borderColor = rgb(mixC(G2, ACC, clamp(fly * 1.2)));
    c1.style.top = (392 + 84 - 84 * fly).toFixed(2) + 'px';
    const dv = vis(t, b(46), b(47), .02, .16, .08); show($(H, '.dots'), dv);
    $$(H, '.dots i').forEach((el, i) => { el.style.transform = `translateY(${(-7 * Math.max(0, Math.sin(t * 8 - i * .9))).toFixed(2)}px)`; });
    const av = vis(t, b(47), T + 1, 0, .2); show($(H, '.ans'), av, .5);
    txt($(H, '.tx'), ANSWER.slice(0, Math.floor(clamp((t - b(47.05)) / 2.4) * ANSWER.length)));
    press($(H, '.me'), t, b(50.5), .05);
  }

  // profile finale
  if (place('prof', t, g).o > 0) {
    const F = C.prof; let n = 0;
    STEPS.forEach((_, i) => {
      const d = $(F, `.st${i} .sd`), k = step(t - DONE[i], ...SP.ui); if (t >= DONE[i]) n++;
      d.style.background = rgb(mixC(WHT, ACC, k)); d.style.borderColor = k > .3 ? '#0071e3' : '#d2d2d7';
      $(d, '.nn').style.opacity = 1 - clamp(k * 3); draw($(d, '.ck'), t, DONE[i] + .05, .24);
      d.style.transform = `scale(${1 + .1 * pulse(t, DONE[i])})`;
    });
    txt($(F, '.pc'), `${n} из 4`);
    $(F, '.pf').style.width = (25 * STEPS.reduce((s, _, i) => s + step(t - DONE[i], ...SP.ui), 0)).toFixed(3) + '%';
    const bx = vis(t, b(53.3), T + 1, 0, .3); show($(F, '.pbox'), bx, 0); show($(F, '.pb0'), bx, .4);
    $(F, '.pbox').style.transform = `translateY(${(1 - bx.o) * 30}px) scale(${.97 + .03 * bx.o})`;
    rise($(F, '.pl1'), t, b(54)); rise($(F, '.pl2'), t, b(54.5));
    const s3 = vis(t, b(55), T + 1, 0, .3); show($(F, '.pb3'), s3, .4);
    const s4 = step(t - b(56), ...SP.ui), p4 = $(F, '.pb4'); p4.style.opacity = clamp(s4); p4.style.transform = `scale(${.85 + .15 * s4})`;
  }

  // step bar
  { const bw = trBarW(t); bar.style.width = bw + 'px'; bar.style.left = (720 - bw / 2) + 'px';
    bar.style.transform = `translateY(${(-150 * fw).toFixed(2)}px)`; // close-ups get the full frame
    const av = vis(t, b(58), b(2.5) + T, .06, .2, .06), bv = vis(t, b(2.5), b(58), .06, .2, .06);
    show(bA, av, .4); show(bB, bv, .4);
    bA.style.left = ((bw - wA) / 2) + 'px'; bB.style.left = ((bw - wB) / 2) + 'px';
    const l = trKL(t), rr = trKR(t); bk.style.left = l + 'px'; bk.style.width = (rr - l) + 'px';
    bwc.style.clipPath = `inset(8px ${(wB - 8 - rr).toFixed(2)}px 8px ${(l - 8).toFixed(2)}px round 32px)`; // white labels only over the knob
    const doneAll = [$$(bar, '.bw .bn'), $$(bar, '.bwc .bn')];
    doneAll.forEach(list => list.forEach((el, i) => {
      const on = wrap(t) >= BAR_DONE[i] && wrap(t) < b(58.5), k = on ? step(wrap(t) - BAR_DONE[i], ...SP.ui) : 0;
      $(el, 'span').style.opacity = 1 - clamp(k * 2.5); $(el, 'svg').style.opacity = clamp(k * 2);
      $(el, '.ck').style.strokeDasharray = `${on ? easeOut((wrap(t) - BAR_DONE[i] - .04) / .24) : 0} 1`;
      if (list === doneAll[0]) { el.style.background = rgb(mixC([240, 240, 243], ACC, k)); el.style.color = k > .4 ? '#fff' : '#6e6e73'; }
      el.style.transform = `scale(${1 + .16 * pulse(t, BAR_DONE[i])})`;
    })); }

  // cursor
  const sx = 720 + (trCX(t) - camX) * cam, sy = 764 + (trCY(t) - camY) * cam;
  cursor.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px) scale(${trCurS(t).toFixed(4)}) translate(-3px,-3px)`;
}

window.T = T; window.BEAT = BEAT; window.seek = seek;
window.EVENTS = { clicks: clicks.map(b), keys: keyTimes, hovers: [b(63), b(0.9), b(27.9), b(42)], ai: b(43), success: [b(12), b(32), b(52.8)],
  ticks: BAR_DONE.concat(DONE), whoosh: CHAP_AT.map(b).concat([b(58)]) };
const qp = new URLSearchParams(location.search);
if (qp.has('t')) seek(+qp.get('t'));
else if (qp.has('play')) { const t0 = performance.now(); const loop = () => { seek((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
else seek(0);
})();
