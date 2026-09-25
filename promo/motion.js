'use strict';
// ---------- timing ----------
const BPM = 120, BEAT = 60 / BPM, BARS = 10, T = BARS * 4 * BEAT; // 20 s
const b = n => n * BEAT;
const wrap = t => ((t % T) + T) % T;
const clamp = (x, a = 0, c = 1) => Math.min(c, Math.max(a, x));
const mix = (a, c, k) => a + (c - a) * k;
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);

// Closed-form step response of a damped spring (0 -> 1). zeta >= 0.82 keeps overshoot under ~1%.
function step(tau, w, z) {
  if (tau <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
const SP = { shape: [15, .87], cam: [10, 1], curX: [15, .9], curY: [12.5, .9], fast: [26, .9], lead: [30, .9], lag: [13, .88], ui: [20, .86], color: [30, 1] };

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
// Enter/exit envelope. Exit (dOut) finishes before a replacement's enter delay (dIn), so swaps never overlap.
function vis(t, tin, tout, dIn = .09, durIn = .22, dOut = .09) {
  const f = x => {
    const e = easeOut((x - tin - dIn) / durIn), q = clamp((x - tout) / dOut);
    return { o: e * (1 - q), bl: 12 * (1 - e) + 10 * q, s: .96 + .04 * e - .03 * q };
  };
  const t0 = wrap(t);
  return [f(t0), f(t0 + T), f(t0 - T)].reduce((m, x) => (x.o > m.o ? x : m));
}
const rgb = c => `rgb(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')})`;
const blur = (el, px) => { el.style.filter = px > .05 ? `blur(${px.toFixed(2)}px)` : 'none'; };
function show(el, v, k = 1) { el.style.opacity = v.o.toFixed(4); blur(el, v.bl * k); el.style.visibility = v.o > .001 ? '' : 'hidden'; } // '' inherits, so a hidden screen hides its children

// ---------- tokens (from navprofr.ru computed styles) ----------
const ACC = [0, 113, 227], ACC_OFF = [153, 199, 241], WHT = [255, 255, 255];
const SW = 4; // screen-px stroke for every line icon
const IC = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4.5M9 13h.01M15 13h.01M9 16.5h6"/><circle cx="12" cy="4" r="1"/>',
  game: '<path d="M7 8h10a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6h-4A4 4 0 0 1 3 13v-1a4 4 0 0 1 4-4z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
};
const icon = (n, px, sw = SW) =>
  `<svg class="ln" width="${px}" height="${px}" viewBox="0 0 24 24" stroke-width="${(sw * 24 / px).toFixed(3)}">${IC[n]}</svg>`;

// ---------- DOM ----------
const shape = document.getElementById('shape'), world = document.getElementById('world'), stage = document.getElementById('stage');
function add(parent, html, cls = 'c') {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d;
}
const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => [...root.querySelectorAll(sel)];
const C = {}, CW = {};
function content(key, html, w, h, parent = shape) {
  const el = add(parent, `<div style="position:relative;width:${w}px;height:${h}px">${html}</div>`);
  el.style.width = w + 'px'; el.style.height = h + 'px'; C[key] = el; CW[key] = [w, h]; return el;
}

// ---- screens (laid out in screen px; each rests at camera scale S so it renders 1:1) ----
const S = {
  hero: { W: 360, H: 116, R: 58, S: 1, bg: ACC, cy: 250 },
  reg: { W: 860, H: 1200, R: 56, S: 1, bg: WHT },
  load: { W: 150, H: 150, R: 75, S: 2.2, bg: ACC },
  done: { W: 640, H: 150, R: 75, S: 1.7, bg: ACC },
  prof: { W: 1080, H: 900, R: 56, S: 1, bg: WHT },
  diag: { W: 1080, H: 1000, R: 56, S: 1, bg: WHT },
  calc: { W: 700, H: 150, R: 75, S: 1.6, bg: WHT },
  res: { W: 1080, H: 960, R: 56, S: 1, bg: WHT },
  trials: { W: 1080, H: 1180, R: 56, S: 1, bg: WHT },
  modal: { W: 880, H: 1060, R: 56, S: 1, bg: WHT },
  ok: { W: 900, H: 176, R: 88, S: 1.45, bg: ACC },
  route: { W: 1000, H: 1060, R: 56, S: 1, bg: WHT },
  chat: { W: 1000, H: 1200, R: 56, S: 1, bg: WHT },
};

// hero page text lives outside the shape, around the "Начать" pill
content('heroText', `
  <div class="a lab" style="left:0;right:0;top:0;text-align:center;font-size:30px">Портал профориентации</div>
  <div class="a" style="left:0;right:0;top:52px;text-align:center;font-size:168px;font-weight:700;letter-spacing:-7px;line-height:1">Карьерный</div>
  <div class="a" style="left:0;right:0;top:220px;text-align:center;font-size:168px;font-weight:700;letter-spacing:-7px;line-height:1;color:#0071e3">навигатор</div>
  <div class="a sub" style="left:0;right:0;top:432px;text-align:center;font-size:34px">От интереса к первому рабочему месту — один профиль.</div>`, 1300, 500, world);
content('hero', `<div class="pill" style="width:100%;height:100%;color:#fff;font-size:38px;gap:14px">Начать <span class="arr">${icon('arrow', 36)}</span></div>`, 360, 116);

content('reg', `
  <div class="a lab" style="left:72px;top:76px">Карьерный навигатор</div>
  <div class="a h1 tA" style="left:72px;top:118px">С возвращением</div>
  <div class="a h1 tB" style="left:72px;top:118px">Начните свой путь</div>
  <div class="a sub" style="left:72px;top:196px;width:700px">Создайте аккаунт: ваши цели и результаты будут сохраняться в профиле.</div>
  <div class="a seg" style="left:72px;top:318px;width:716px;height:78px;border-radius:18px;background:#f5f5f7">
    <div class="a knob" style="top:6px;height:66px;border-radius:13px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08),0 3px 10px rgba(0,0,0,.08)"></div>
    <div class="a s0" style="left:0;width:358px;top:0;height:78px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:500">Войти</div>
    <div class="a s1" style="left:358px;width:358px;top:0;height:78px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:500">Создать аккаунт</div></div>
  <div class="a fl" style="left:72px;top:436px">Как к вам обращаться?</div>
  <div class="a inp f0" style="left:72px;top:474px;width:716px"><span class="ph">Ваше имя</span><span class="v"></span><i class="caret"></i></div>
  <div class="a fl" style="left:72px;top:582px">Логин</div>
  <div class="a inp f1" style="left:72px;top:620px;width:716px"><span class="ph">Например, alex_2026</span><span class="v"></span><i class="caret"></i></div>
  <div class="a fl" style="left:72px;top:728px">Пароль</div>
  <div class="a inp f2" style="left:72px;top:766px;width:716px"><span class="ph"></span><span class="v" style="letter-spacing:4px"></span><i class="caret"></i></div>
  <div class="a fl" style="left:72px;top:874px">Я здесь как</div>
  ${['Участник', 'Наставник', 'Родитель'].map((s, i) => `<div class="a chip role r${i}" style="left:${72 + i * 244}px;top:912px;width:228px;height:74px">${s}</div>`).join('')}
  <div class="a pill sb" style="left:72px;top:1030px;width:716px;height:88px;font-size:28px;color:#fff">Создать аккаунт</div>
  <div class="a" style="left:72px;top:1136px;width:716px;font-size:19px;color:#86868b;line-height:1.35">Это аккаунт Карьерного навигатора, не «Работы России».</div>`, 860, 1200);

content('load', `<svg width="150" height="150" viewBox="0 0 150 150">
  <circle cx="75" cy="75" r="34" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8"/>
  <circle class="arc" cx="75" cy="75" r="34" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" pathLength="1"/></svg>`, 150, 150);

content('done', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:22px;color:#fff">
  <svg class="ln" width="52" height="52" viewBox="0 0 24 24" stroke-width="${(6 * 24 / 52).toFixed(2)}"><path class="ck" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
  <span style="font-size:40px;font-weight:600;letter-spacing:-.6px">Профиль создан</span></div>`, 640, 150);

const STEPS = ['Диагностика', 'Профессиональная проба', 'Маршрут', 'Первый отклик'];
content('prof', `
  <div class="a" style="left:72px;top:72px;width:116px;height:116px;border-radius:58px;background:#0071e3;color:#fff;font-size:52px;font-weight:600;display:flex;align-items:center;justify-content:center">А</div>
  <div class="a lab" style="left:216px;top:80px">Личный кабинет</div>
  <div class="a h1" style="left:216px;top:114px;font-size:54px">Алина</div>
  <div class="a sub" style="left:72px;top:232px">Ваши интересы, достижения и следующий шаг — в одном месте.</div>
  <div class="a fl" style="left:72px;top:318px">Прогресс</div><div class="a fl" style="right:72px;top:318px;color:#86868b">0 из 4</div>
  <div class="a" style="left:72px;top:360px;width:936px;height:10px;border-radius:5px;background:#e8e8ed"></div>
  ${STEPS.map((s, i) => `<div class="a" style="left:${72 + i * 234}px;top:398px;width:222px">
    <div style="width:52px;height:52px;border-radius:26px;border:3px solid ${i ? '#d2d2d7' : '#0071e3'};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:${i ? '#86868b' : '#0071e3'}">${i + 1}</div>
    <div style="margin-top:14px;font-size:24px;font-weight:500;line-height:1.3;color:${i ? '#86868b' : '#1d1d1f'}">${s}</div></div>`).join('')}
  <div class="a" style="left:72px;top:566px;width:936px;height:262px;border-radius:32px;background:#f5f5f7"></div>
  <div class="a lab" style="left:112px;top:604px">Следующий шаг</div>
  <div class="a" style="left:112px;top:642px;font-size:40px;font-weight:700;letter-spacing:-1px">Пройдите диагностику</div>
  <div class="a sub" style="left:112px;top:696px">Она поможет определить подходящие направления.</div>
  <div class="a pill pb go" style="left:112px;top:746px;width:330px;height:62px;font-size:24px">Начать диагностику</div>`, 1080, 900);

const Q = [
  { n: 3, q: 'Что вам интереснее делать в свободное время?', o: ['Собирать и программировать гаджеты', 'Рисовать и придумывать дизайн', 'Помогать людям разобраться в проблеме', 'Организовывать события'] },
  { n: 4, q: 'Какая задача вам ближе?', o: ['Разобраться, как устроен механизм', 'Сделать красивую презентацию', 'Выслушать и поддержать друга', 'Собрать команду под проект'] }];
content('diag', `
  <div class="a lab" style="left:72px;top:76px">Диагностика</div>
  <div class="a h1" style="left:72px;top:116px;font-size:52px">Интересы и склонности</div>
  <div class="a fl cnt" style="right:72px;top:84px;color:#86868b"></div>
  <div class="a" style="left:72px;top:214px;width:936px;height:10px;border-radius:5px;background:#e8e8ed;overflow:hidden"><div class="bar" style="height:100%;background:#0071e3;border-radius:5px"></div></div>
  ${Q.map((q, k) => `<div class="a qq q${k}" style="left:0;top:0;width:1080px;height:1000px">
    <div class="a" style="left:72px;top:272px;width:936px;font-size:40px;font-weight:600;letter-spacing:-.8px;line-height:1.22">${q.q}</div>
    ${q.o.map((o, i) => `<div class="opt o${i}" style="top:380px;transform:translateY(${i * 116}px)"><div class="radio"><i></i></div>${o}</div>`).join('')}</div>`).join('')}
  <div class="a pill pg" style="left:72px;top:880px;width:200px;height:76px;font-size:26px">Назад</div>
  <div class="a pill pb nx" style="right:72px;top:880px;width:340px;height:76px;font-size:26px"><span class="a nA">Далее</span><span class="a nB">Показать результат</span></div>`, 1080, 1000);

content('calc', `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:24px">
  <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="20" fill="none" stroke="#e8e8ed" stroke-width="6"/>
  <circle class="arc" cx="26" cy="26" r="20" fill="none" stroke="#0071e3" stroke-width="6" stroke-linecap="round" pathLength="1"/></svg>
  <span style="font-size:36px;font-weight:600;letter-spacing:-.5px">Считаем результат…</span></div>`, 700, 150);

const TOP3 = [['IT и цифровые технологии', 92], ['Инженерия и робототехника', 78], ['Дизайн и медиа', 64]];
content('res', `
  <div class="a lab" style="left:72px;top:76px">Результаты</div>
  <div class="a h1" style="left:72px;top:116px;font-size:52px">Сильные направления</div>
  <div class="a saved" style="right:72px;top:118px;height:56px;padding:0 22px;border-radius:28px;background:#e8f1fc;color:#0071e3;font-size:22px;font-weight:600;display:flex;align-items:center;gap:10px;transform-origin:100% 50%">${icon('check', 24, 3)}Сохранено в профиле</div>
  <div class="a sub" style="left:72px;top:200px;width:936px">Порядок — по сумме ответов. Это гипотезы: проверьте их на профпробах.</div>
  ${TOP3.map(([n], i) => `<div class="a" style="left:72px;top:${322 + i * 150}px;width:936px">
    <div style="font-size:21px;font-weight:600;color:#86868b">${i + 1} место</div>
    <div style="font-size:34px;font-weight:600;letter-spacing:-.6px;margin-top:6px">${n}</div>
    <div class="a sc s${i}" style="right:0;top:26px;font-size:36px;font-weight:700;letter-spacing:-.6px;color:#0071e3">0</div>
    <div style="margin-top:16px;height:14px;border-radius:7px;background:#e8e8ed"><div class="rb r${i}" style="height:100%;border-radius:7px;background:#0071e3;opacity:${[1, .72, .48][i]};width:0"></div></div></div>`).join('')}
  <div class="a pill pb pick" style="left:72px;top:812px;width:420px;height:84px;font-size:27px">Подобрать профпробу</div>
  <div class="a pill pg" style="left:512px;top:812px;width:280px;height:84px;font-size:27px">Отчёт в PDF</div>`, 1080, 960);

const TRIALS = [['3Д моделирование для компьютерных игр', 'cube'], ['Мобильная робототехника', 'robot'], ['Тестирование игрового ПО', 'game']];
content('trials', `
  <div class="a lab" style="left:72px;top:76px">Профессиональные пробы</div>
  <div class="a h1" style="left:72px;top:116px;font-size:50px;white-space:nowrap">Попробуйте профессию на практике</div>
  <div class="a sub" style="left:72px;top:200px">Запишитесь на профпробу прямо здесь.</div>
  <div class="a" style="left:72px;top:282px;display:flex;gap:14px">
    <div class="pill pb" style="height:62px;padding:0 28px;font-size:23px">По диагностике</div>
    <div class="pill pg" style="height:62px;padding:0 28px;font-size:23px;font-weight:500">Санкт-Петербург</div>
    <div class="pill pg" style="height:62px;padding:0 28px;font-size:23px;font-weight:500">Онлайн и очно</div></div>
  ${TRIALS.map(([n, ic], i) => `<div class="card tc${i}" style="top:${396 + i * 222}px">
    <div class="ibox">${icon(ic, 56)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:30px;font-weight:600;letter-spacing:-.5px;line-height:1.2;width:470px">${n}</div>
      <div style="font-size:22px;color:#86868b;margin-top:10px">Академия инженерных технологий · Очно</div></div>
    <div class="pill pb go" style="width:190px;height:64px;font-size:23px;margin-right:30px;flex:none">Записаться</div></div>`).join('')}
  <div class="a" style="left:72px;top:1080px;font-size:20px;color:#86868b">Источник проверен · СПб ГБПОУ «Академия инженерных технологий и управления»</div>`, 1080, 1180);

const SLOTS = ['12 окт · 11:00', '12 окт · 14:00', '19 окт · 11:00'];
content('modal', `
  <div class="a lab" style="left:72px;top:76px">Запись на профпробу</div>
  <div class="a h1" style="left:72px;top:116px;font-size:46px;width:740px;letter-spacing:-1.2px">3Д моделирование для компьютерных игр</div>
  <div class="a sub" style="left:72px;top:232px;font-size:23px;width:740px">СПб ГБПОУ «Академия инженерных технологий и управления»</div>
  <div class="a fl" style="left:72px;top:334px">Дата и время</div>
  ${SLOTS.map((s, i) => `<div class="a chip slot sl${i}" style="left:${72 + i * 244}px;top:374px;width:228px;height:80px">${s}</div>`).join('')}
  <div class="a fl" style="left:72px;top:494px">ФИО участника</div>
  <div class="a inp" style="left:72px;top:532px;width:736px">Алина Смирнова</div>
  <div class="a fl" style="left:72px;top:640px">Школа</div>
  <div class="a inp" style="left:72px;top:678px;width:736px">ГБОУ СОШ № 123</div>
  <div class="a cb" style="left:72px;top:800px;width:40px;height:40px;border-radius:11px;border:2.5px solid #c7c7cc;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#fff">
    <svg class="ln" width="26" height="26" viewBox="0 0 24 24" stroke-width="3.6"><path class="ck" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <div class="a" style="left:134px;top:798px;width:674px;font-size:22px;line-height:1.4;color:#424245">Согласен(на) на обработку персональных данных для записи на профпробу.</div>
  <div class="a pill pg" style="left:72px;top:920px;width:250px;height:84px;font-size:27px">Отмена</div>
  <div class="a pill sb" style="left:342px;top:920px;width:466px;height:84px;font-size:27px;color:#fff">Записаться</div>`, 880, 1060);

content('ok', `<div style="width:100%;height:100%;display:flex;align-items:center;color:#fff">
  <div style="width:112px;height:112px;border-radius:56px;background:#fff;color:#0071e3;margin-left:32px;display:flex;align-items:center;justify-content:center;flex:none">
    <svg class="ln" width="56" height="56" viewBox="0 0 24 24" stroke-width="3"><path class="ck" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <div style="margin-left:30px"><div style="font-size:42px;font-weight:700;letter-spacing:-.8px">Вы записаны</div>
  <div style="font-size:25px;opacity:.82;margin-top:4px">12 октября, 11:00 · с вами свяжутся</div></div></div>`, 900, 176);

const RSTEPS = [['Диагностика', 'ТОП-3: IT, инженерия, дизайн'], ['Профессиональная проба', '3Д моделирование · 12 окт, 11:00'], ['Маршрут', 'Сценарий: широкий набор проб'], ['Первый отклик', 'Стажировки и вакансии']];
content('route', `
  <div class="a lab" style="left:72px;top:76px">Маршрут</div>
  <div class="a h1" style="left:72px;top:116px;font-size:52px">Образовательный маршрут</div>
  <div class="a sub" style="left:72px;top:198px;width:856px">Не нужно решать всё сразу. Двигайтесь по одному шагу.</div>
  <div class="a" style="left:72px;top:282px;width:856px;height:84px;border-radius:20px;background:#f5f5f7;display:flex;align-items:center;padding:0 28px;box-sizing:border-box;font-size:24px">
    <span style="font-weight:600">Не знаю, кем хочу быть</span><span style="color:#86868b;margin-left:12px">· Широкий набор проб</span><span class="rc" style="margin-left:auto;font-weight:600;color:#0071e3"></span></div>
  <div class="a" style="left:103px;top:470px;width:4px;height:396px;border-radius:2px;background:#e8e8ed"><div class="rl" style="width:100%;background:#0071e3;border-radius:2px"></div></div>
  ${RSTEPS.map(([n, m], i) => `<div class="a" style="left:72px;top:${436 + i * 132}px;width:856px;height:100px;display:flex;align-items:center">
    <div class="dot d${i}" style="width:66px;height:66px;border-radius:33px;box-sizing:border-box;border:3px solid #d2d2d7;background:#fff;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;position:relative">
      <span class="a nn" style="font-size:25px;font-weight:600;color:#86868b">${i + 1}</span>
      <svg class="ln a" width="34" height="34" viewBox="0 0 24 24" stroke-width="3.4"><path class="ck" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <div style="margin-left:30px"><div style="font-size:31px;font-weight:600;letter-spacing:-.5px">${n}</div><div style="font-size:23px;color:#86868b;margin-top:4px">${m}</div></div></div>`).join('')}
  <div class="a pill pg ask" style="left:72px;top:936px;width:420px;height:80px;font-size:26px">Обсудить с помощником</div>`, 1000, 1060);

const ASK = 'Куда записаться на пробу?';
const ANSWER = 'По вашим результатам подойдут пробы «3Д моделирование для компьютерных игр» и «Мобильная робототехника» в Академии инженерных технологий. Следующий шаг — выберите слот, запись прямо в чате.';
content('chat', `
  <div class="a" style="left:56px;top:56px;width:80px;height:80px;border-radius:40px;background:#0071e3;color:#fff;font-size:36px;font-weight:600;display:flex;align-items:center;justify-content:center">Н</div>
  <div class="a" style="left:160px;top:60px;font-size:32px;font-weight:700;letter-spacing:-.6px">Карьерный AI-помощник</div>
  <div class="a" style="left:160px;top:102px;font-size:22px;color:#86868b">Карьерный навигатор · AI</div>
  <div class="a home" style="right:56px;top:74px;font-size:23px;font-weight:600;color:#0071e3;display:flex;align-items:center;gap:8px">${icon('back', 26, 3)}На главную</div>
  <div class="a" style="left:0;right:0;top:168px;height:2px;background:#f0f0f2"></div>
  <div class="bub" style="left:56px;top:212px;width:640px;background:#f5f5f7">Помогу найти свой путь. Расскажите, что вам нравится — вместе найдём, с чего начать.</div>
  <div class="a sug" style="left:56px;top:400px;display:flex;gap:14px">
    <div class="pill pg" style="height:60px;padding:0 24px;font-size:22px;font-weight:500">Какие направления мне подходят?</div>
    <div class="pill pg" style="height:60px;padding:0 24px;font-size:22px;font-weight:500">Что добавить в портфолио?</div></div>
  <div class="bub me" style="right:56px;top:500px;background:#0071e3;color:#fff;transform-origin:100% 100%">${ASK}</div>
  <div class="bub dots" style="left:56px;top:612px;background:#f5f5f7;display:flex;gap:10px;padding:30px 30px">${'<i style="display:block;width:14px;height:14px;border-radius:7px;background:#86868b"></i>'.repeat(3)}</div>
  <div class="bub ans" style="left:56px;top:612px;width:780px;background:#f5f5f7"><span class="tx"></span></div>
  <div class="a acard" style="left:56px;top:900px;width:780px;height:104px;border-radius:24px;border:2px solid #e8e8ed;box-sizing:border-box;display:flex;align-items:center">
    <div style="width:64px;height:64px;border-radius:16px;background:#e8f1fc;color:#0071e3;display:flex;align-items:center;justify-content:center;margin:0 20px 0 20px">${icon('cube', 34, 3)}</div>
    <div style="font-size:24px;font-weight:600;flex:1">3Д моделирование · 12 окт</div><div class="pill pb" style="height:54px;padding:0 24px;font-size:21px;margin-right:22px">К записи</div></div>
  <div class="a" style="left:56px;right:56px;top:1044px;height:96px;border-radius:48px;background:#f5f5f7;display:flex;align-items:center;padding:0 16px 0 34px;box-sizing:border-box">
    <span class="ci" style="font-size:27px;white-space:pre;flex:1"><span class="ph">О чём поговорим?</span><span class="v"></span><i class="caret"></i></span>
    <div class="send" style="width:66px;height:66px;border-radius:33px;display:flex;align-items:center;justify-content:center;color:#fff">${icon('up', 32, 3.4)}</div></div>`, 1000, 1200);

const cursor = add(stage, `<svg width="46" height="60" viewBox="0 0 23 30"><path d="M1.5 1.5v22.2l5.6-5.1 3.6 8.4 3.9-1.7-3.6-8.2 7.6-.3z" fill="#1d1d1f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`, '');
cursor.id = 'cursor';

// ---------- timeline (beats) ----------
const SEQ = [[0, 'hero'], [2, 'reg'], [9, 'load'], [10, 'done'], [11, 'prof'], [13, 'diag'], [17, 'calc'], [18, 'res'],
  [21, 'trials'], [24, 'modal'], [27, 'ok'], [28, 'route'], [31, 'chat'], [38, 'hero']];
const WIN = {}; SEQ.forEach(([bb, k], i) => { if (!WIN[k] || k !== 'hero') WIN[k] = [b(bb), b(SEQ[(i + 1) % SEQ.length][0]) + (i === SEQ.length - 1 ? T : 0)]; });
WIN.hero = [b(38), b(2) + T];

const typed = (txt, t0, dt) => t => txt.slice(0, clamp(Math.floor((wrap(t) - t0) / dt) + 1, 0, txt.length));
const TYPE = {
  name: { txt: 'Алина', t0: b(3.75), dt: .125 }, login: { txt: 'alina_2026', t0: b(5.25), dt: .1 },
  pass: { txt: '••••••••••••', t0: b(6.75), dt: .07 }, ask: { txt: ASK, t0: b(31.75), dt: .055 }};
for (const k in TYPE) TYPE[k].f = typed(TYPE[k].txt, TYPE[k].t0, TYPE[k].dt);
const keyTimes = Object.values(TYPE).flatMap(o => [...o.txt].map((_, i) => o.t0 + i * o.dt));

const HOVER = [[b(0.8), 1], [b(2), 0]];
const HERO_W = t => S.hero.W + 18 * trHover(t);
const trHover = track(HOVER.map(([t, v]) => [t, v, SP.ui]));
function dimsOf(k) { const s = S[k]; return { w: s.W / s.S, h: s.H / s.S, r: s.R / s.S, bg: s.bg, S: s.S, cy: s.cy || 0 }; }
const dims = SEQ.map(([bb, k]) => [b(bb), dimsOf(k)]);
// shrinking into a dark pill: recolor once it is small, so a big area never flashes mid-tone
const COLOR_DELAY = { load: .12, done: 0, ok: .12, hero: .12 };
const trW = track(dims.map(([t, d]) => [t, d.w]));
const trH = track(dims.map(([t, d]) => [t, d.h]));
const trR = track(dims.map(([t, d]) => [t, d.r]));
const trCy = track(dims.map(([t, d]) => [t, d.cy]));
const trBg = track(dims.map(([t, d], i) => [t + (COLOR_DELAY[SEQ[i][1]] || 0), d.bg]), SP.color);

// camera: state framing plus focus pushes on the register form
const FOCUS = [[b(3.4), 1.26, -150], [b(7.6), 1.22, 330], [b(8.7), 1, 0]];
const camEv = dims.map(([t, d]) => [t, [d.S, 0]]).concat(FOCUS.map(([t, s, y]) => [t, [s, y]]));
const trCam = track(camEv, SP.cam);
const trFocus = track([[b(3.4), 1, SP.cam], [b(8.7), 0, SP.cam]]);

// clicks (beats). Every click also pulses the shape a little when it lands on it.
const CLICK_B = [2, 3, 3.5, 5, 6.5, 8, 9, 13, 14, 15, 16, 17, 21, 24, 25, 26, 27, 31, 31.5, 33.5, 37.5];
const clicks = CLICK_B.map(b);
const trPress = track([2, 9, 17, 27].map(b).flatMap(t => [[t - .07, .97, SP.fast], [t + .06, 1, SP.ui]]));
const trCurS = track(clicks.flatMap(t => [[t - .07, .84, SP.fast], [t + .05, 1, SP.ui]]));

// ---------- layout probing: cursor targets come from real element positions ----------
function elPos(key, sel, fx = .5, fy = .5) {
  const root = C[key]; let el = typeof sel === 'string' ? $(root, sel) : sel, x = 0, y = 0;
  const w = el.offsetWidth, h = el.offsetHeight;
  let tr = getComputedStyle(el).transform;
  if (tr && tr !== 'none') { const m = new DOMMatrix(tr); x += m.m41; y += m.m42; }
  while (el && el !== root) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  const [W, H] = CW[key], st = dimsOf(key);
  return [(x + w * fx - W / 2) / st.S, (y + h * fy - H / 2) / st.S + st.cy];
}
const P = {
  hero: elPos('hero', '.pill', .56, .62),
  seg1: elPos('reg', '.s1', .62, .6), f0: elPos('reg', '.f0', .7, .6), f1: elPos('reg', '.f1', .74, .62), f2: elPos('reg', '.f2', .68, .6),
  role: elPos('reg', '.r0', .58, .62), sb: elPos('reg', '.sb', .56, .62),
  go: elPos('prof', '.go', .6, .62), o0: elPos('diag', '.q0 .o0', .44, .6), o1: elPos('diag', '.q1 .o0', .46, .6), nx: elPos('diag', '.nx', .5, .62),
  pick: elPos('res', '.pick', .55, .62), tc0: elPos('trials', '.tc0', .45, .55), tgo: elPos('trials', '.tc0 .go', .52, .62),
  sl0: elPos('modal', '.sl0', .56, .6), cb: elPos('modal', '.cb', .6, .66), msb: elPos('modal', '.sb', .56, .62),
  ask: elPos('route', '.ask', .56, .62), ci: elPos('chat', '.ci', .3, .6), send: elPos('chat', '.send', .56, .62), home: elPos('chat', '.home', .6, .66),
};
const CLICK_AT = { 2: 'hero', 3: 'seg1', 3.5: 'f0', 5: 'f1', 6.5: 'f2', 8: 'role', 9: 'sb', 13: 'go', 14: 'o0', 15: 'nx', 16: 'o1', 17: 'nx',
  21: 'pick', 24: 'tgo', 25: 'sl0', 26: 'cb', 27: 'msb', 31: 'ask', 31.5: 'ci', 33.5: 'send', 37.5: 'home' };
const CUR = [[.02, P.hero]]; // events must lie inside [0, T) for the wrap to stay seamless
let prev = -1;
for (const cb of CLICK_B) {
  const t = b(cb), p = P[CLICK_AT[cb]];
  if (cb !== 2) CUR.push([Math.max(prev + .06, t - .42), p]);
  prev = t;
}
// idle positions while states that need no cursor play out; screen-space drift keeps the cursor alive
CUR.push([b(9.3), [58, 60]], [b(17.3), [210, 58]], [b(19.2), [120, 180]], [b(22.2), P.tc0], [b(27.3), [300, 90]], [b(29), [180, 260]],
  [b(34.2), [330, 60]], [b(36), [300, 180]], [b(38.4), [120, 380]], [b(39.3), [150, 330]]);
const trCX = track(CUR.map(([t, p]) => [t, p[0]]), SP.curX);
const trCY = track(CUR.map(([t, p]) => [t, p[1]]), SP.curY);

// ---------- per-screen micro-tracks ----------
const trSegL = track([[b(2), 6, SP.ui], [b(3), 358, SP.lag]]), trSegR = track([[b(2), 352, SP.ui], [b(3), 710, SP.lead]]);
const trSubmit = track([[b(2), ACC_OFF], [b(7.9), ACC]], SP.ui);
const trRole = track([[b(2), 0], [b(8), 1, SP.ui]]);
const trBar = track([[b(13), 3 / 12], [b(15), 4 / 12], [b(17), 5 / 12]], SP.ui);
const trSel0 = track([[b(13), 0], [b(14), 1, SP.ui]]), trSel1 = track([[b(13), 0], [b(16), 1, SP.ui]]);
const trHov = track([[b(21), 0], [b(22.3), 1, SP.ui], [b(24), 0, SP.ui]]);
const trSlot = track([[b(24), 0], [b(25), 1, SP.ui]]), trCb = track([[b(24), 0], [b(26), 1, SP.ui]]);
const trMsb = track([[b(24), ACC_OFF], [b(26.05), ACC]], SP.ui);
const trRL = track([[b(28), 0], [b(28.4), 132, SP.ui], [b(29), 264, SP.ui], [b(30), 330, SP.ui]]);
const DONE_AT = [b(28.4), b(29), b(30)];
const trMe = track([[b(31), 0], [b(33.5), 1, SP.ui]]);

// ---------- render ----------
function place(el, key, t, g, opt) {
  const [tin, tout] = WIN[key];
  const v = vis(t, tin, tout, ...(opt || [.12, .24]));
  el.style.visibility = v.o > .001 ? 'visible' : 'hidden';
  if (v.o <= .001) return v;
  el.style.opacity = v.o.toFixed(4); blur(el, v.bl);
  const [W, H] = CW[key], st = dimsOf(key);
  el.style.transform = `translate(${g.w / 2 - g.cx}px,${g.h / 2 + st.cy - g.cy}px) scale(${v.s / st.S}) translate(${-W / 2}px,${-H / 2}px)`;
  return v;
}
const setChip = (el, k) => { el.style.borderColor = rgb([210 + (0 - 210) * k, 210 + (113 - 210) * k, 215 + (227 - 215) * k]); el.style.background = rgb([255 - 23 * k, 255 - 14 * k, 255 - 3 * k]); el.style.color = k > .5 ? '#0071e3' : '#1d1d1f'; };
function typeInto(inp, o, t, t1) {
  const s = o.f(t), active = wrap(t) >= o.t0 - .3 && wrap(t) < t1;
  const v = $(inp, '.v'); if (v.textContent !== s) v.textContent = s;
  $(inp, '.ph').style.display = s ? 'none' : '';
  const blink = (wrap(t) - o.t0 + o.txt.length * o.dt) % 1 < .55 || (wrap(t) >= o.t0 - .05 && wrap(t) < o.t0 + o.txt.length * o.dt + .1);
  $(inp, '.caret').style.opacity = active && blink ? 1 : 0;
  inp.style.borderColor = active ? 'rgba(0,113,227,.55)' : 'transparent';
  inp.style.background = active ? '#fff' : '#f5f5f7';
}
const spin = (arc, x, base = 0) => { const len = .2 + .45 * Math.pow(Math.sin(Math.PI * clamp(x / 1.2)), 2); arc.style.strokeDasharray = `${len} 1`; arc.style.transformOrigin = 'center'; arc.style.transformBox = 'fill-box'; arc.style.transform = `rotate(${base - 90 + x * 520}deg)`; };

function seek(tRaw) {
  const t = wrap(tRaw);
  let w = trW(t), h = trH(t), r = trR(t), cy = trCy(t), cx = 0;
  const inHero = t >= b(38) - .01 || t < b(2.2);
  if (inHero) w += 18 * trHover(t);
  r = Math.min(r, h / 2, w / 2);
  shape.style.width = w + 'px'; shape.style.height = h + 'px';
  shape.style.left = (cx - w / 2) + 'px'; shape.style.top = (cy - h / 2) + 'px';
  shape.style.borderRadius = r + 'px'; shape.style.background = rgb(trBg(t));
  shape.style.transform = `scale(${trPress(t)})`;
  const g = { w, h, cx, cy };

  // camera: soft-min against "shape fits the frame", relaxed while a focus push is active
  const [c0, fy] = trCam(t), fit = Math.min(1340 / w, 1360 / h), K = .05;
  const soft = -K * Math.log(Math.exp(-c0 / K) + Math.exp(-fit / K));
  const cam = mix(soft, c0, trFocus(t));
  const camY = fy;
  world.style.transform = `translate(720px,720px) scale(${cam}) translate(0px,${-camY}px)`;

  // hero text (outside the shape)
  { const v = vis(t, WIN.hero[0], WIN.hero[1], .12, .3, .12); show(C.heroText, v);
    C.heroText.style.transform = `translate(${-650}px,${-420 - 20 * (1 - v.o)}px) scale(${v.s})`; C.heroText.style.transformOrigin = '650px 420px'; }
  place(C.hero, 'hero', t, g, [.1, .22]);
  $(C.hero, '.arr').style.transform = `translateX(${(trHover(t) * 8).toFixed(2)}px)`;

  // register
  if (place(C.reg, 'reg', t, g).o > 0) {
    const R = C.reg;
    show($(R, '.tA'), vis(t, -1, b(3))); show($(R, '.tB'), vis(t, b(3), T + 1));
    const kn = $(R, '.knob'), l = trSegL(t), rr = trSegR(t); kn.style.left = l + 'px'; kn.style.width = (rr - l) + 'px';
    const k = clamp((t - b(3)) / .15); $(R, '.s0').style.color = rgb([29 + 105 * k, 29 + 105 * k, 31 + 107 * k]); $(R, '.s1').style.color = rgb([134 - 105 * k, 134 - 105 * k, 139 - 108 * k]);
    typeInto($(R, '.f0'), TYPE.name, t, b(5)); typeInto($(R, '.f1'), TYPE.login, t, b(6.5)); typeInto($(R, '.f2'), TYPE.pass, t, b(7.9));
    setChip($(R, '.r0'), trRole(t)); setChip($(R, '.r1'), 0); setChip($(R, '.r2'), 0);
    $(R, '.sb').style.background = rgb(trSubmit(t));
    $(R, '.sb').style.transform = `scale(${t > b(9) - .07 && t < b(9) + .3 ? 1 - .03 * (1 - step(t - b(9) + .07, ...SP.ui)) : 1})`;
  }
  if (place(C.load, 'load', t, g, [.1, .2]).o > 0) spin($(C.load, '.arc'), t - b(9));
  if (place(C.done, 'done', t, g, [.1, .2]).o > 0) $(C.done, '.ck').style.strokeDasharray = `${easeOut((t - b(10) - .12) / .3)} 1`;

  // profile
  if (place(C.prof, 'prof', t, g).o > 0) {
    $(C.prof, '.go').style.transform = `scale(${t > b(13) - .07 ? 1 - .04 * (1 - step(t - b(13) + .07, ...SP.ui)) : 1})`;
  }
  // diagnostics
  if (place(C.diag, 'diag', t, g).o > 0) {
    const D = C.diag, n = t < b(15) ? 3 : 4;
    const cnt = $(D, '.cnt'), s = `Вопрос ${n} из 12`; if (cnt.textContent !== s) cnt.textContent = s;
    $(D, '.bar').style.width = (trBar(t) * 100).toFixed(3) + '%';
    [0, 1].forEach(q => {
      const tin = q ? b(15) : -1, tout = q ? T + 1 : b(15);
      show($(D, '.q' + q + ' > div'), vis(t, tin, tout, .09, .24));
      $$(D, `.q${q} .opt`).forEach((o, i) => {
        const v = vis(t, q ? tin + .04 * i : tin, tout, .09, .24); show(o, v, .5);
        o.style.transform = `translateY(${i * 116 + (1 - v.o) * 14 * (q ? 1 : 0)}px)`;
        const sel = i === 0 ? (q ? trSel1(t) : trSel0(t)) : 0;
        o.style.borderColor = rgb([232 - 232 * sel, 232 - 119 * sel, 237 - 10 * sel]); o.style.background = rgb([255 - 15 * sel, 255 - 9 * sel, 255 - 2 * sel]);
        $(o, '.radio').style.borderColor = sel > .5 ? '#0071e3' : '#c7c7cc'; $(o, '.radio i').style.transform = `scale(${sel})`;
      });
    });
    show($(D, '.nA'), vis(t, -1, b(15.5))); show($(D, '.nB'), vis(t, b(15.5), T + 1));
    $(D, '.nx').style.transform = `scale(${[15, 17].reduce((m, c) => (t > b(c) - .07 && t < b(c) + .4 ? 1 - .04 * (1 - step(t - b(c) + .07, ...SP.ui)) : m), 1)})`;
  }
  if (place(C.calc, 'calc', t, g, [.12, .2]).o > 0) spin($(C.calc, '.arc'), t - b(17));
  // results
  if (place(C.res, 'res', t, g).o > 0) {
    TOP3.forEach(([, v], i) => {
      const p = easeOut((t - b(18) - .3 - i * .14) / .9);
      $(C.res, '.r' + i).style.width = (v * p).toFixed(2) + '%';
      const sc = $(C.res, '.s' + i), s = String(Math.round(v * p)); if (sc.textContent !== s) sc.textContent = s;
    });
    const sv = step(t - b(19.5), ...SP.ui); const sa = $(C.res, '.saved'); sa.style.opacity = sv; sa.style.transform = `scale(${.85 + .15 * sv})`;
    $(C.res, '.pick').style.transform = `scale(${t > b(21) - .07 ? 1 - .04 * (1 - step(t - b(21) + .07, ...SP.ui)) : 1})`;
  }
  // trials
  if (place(C.trials, 'trials', t, g).o > 0) {
    const hv = trHov(t);
    TRIALS.forEach((_, i) => {
      const c = $(C.trials, '.tc' + i), v = vis(t, b(21) + .1 + i * .07, WIN.trials[1], .1, .26); show(c, v, .5);
      c.style.transform = `translateY(${(1 - v.o) * 24 - (i === 0 ? 4 * hv : 0)}px)`;
      c.style.background = i === 0 ? rgb([245 - 10 * hv, 245 - 10 * hv, 247 - 8 * hv]) : '#f5f5f7';
    });
  }
  // modal
  if (place(C.modal, 'modal', t, g).o > 0) {
    setChip($(C.modal, '.sl0'), trSlot(t)); setChip($(C.modal, '.sl1'), 0); setChip($(C.modal, '.sl2'), 0);
    const k = trCb(t), cb = $(C.modal, '.cb'); cb.style.background = rgb([255 - 255 * k, 255 - 142 * k, 255 - 28 * k]); cb.style.borderColor = k > .3 ? '#0071e3' : '#c7c7cc';
    $(cb, '.ck').style.strokeDasharray = `${easeOut((t - b(26) - .05) / .22)} 1`;
    $(C.modal, '.sb').style.background = rgb(trMsb(t));
  }
  if (place(C.ok, 'ok', t, g, [.1, .2]).o > 0) $(C.ok, '.ck').style.strokeDasharray = `${easeOut((t - b(27) - .15) / .3)} 1`;
  // route
  if (place(C.route, 'route', t, g).o > 0) {
    $(C.route, '.rl').style.height = trRL(t).toFixed(2) + 'px';
    let n = 0;
    RSTEPS.forEach((_, i) => {
      const d = $(C.route, '.d' + i), k = i < 3 ? step(t - DONE_AT[i], ...SP.ui) : 0; if (i < 3 && t >= DONE_AT[i]) n++;
      d.style.background = rgb([255 - 255 * k, 255 - 142 * k, 255 - 28 * k]); d.style.borderColor = k > .3 ? '#0071e3' : (i === 3 ? '#d2d2d7' : '#d2d2d7');
      $(d, '.nn').style.opacity = 1 - clamp(k * 3); $(d, '.ck').style.strokeDasharray = `${i < 3 ? easeOut((t - DONE_AT[i] - .06) / .26) : 0} 1`;
      d.style.transform = `scale(${1 + .08 * Math.sin(Math.PI * clamp((t - DONE_AT[i]) / .3)) * (i < 3 ? 1 : 0)})`;
    });
    const rc = $(C.route, '.rc'), s = `${n} из 4`; if (rc.textContent !== s) rc.textContent = s;
  }
  // chat
  if (place(C.chat, 'chat', t, g).o > 0) {
    const H = C.chat, ci = $(H, '.ci'), sent = t >= b(33.5);
    const s = sent ? '' : TYPE.ask.f(t), v = $(ci, '.v'); if (v.textContent !== s) v.textContent = s;
    $(ci, '.ph').style.display = s ? 'none' : '';
    $(ci, '.caret').style.opacity = t > b(31.5) && !sent ? 1 : 0;
    $(H, '.send').style.background = s ? '#0071e3' : '#c7c7cc';
    $(H, '.send').style.transform = `scale(${t > b(33.5) - .07 && t < b(34) ? 1 - .1 * (1 - step(t - b(33.5) + .07, ...SP.ui)) : 1})`;
    const me = trMe(t), m = $(H, '.me'); m.style.opacity = clamp(me * 1.4); m.style.transform = `translateY(${(1 - me) * 40}px) scale(${.9 + .1 * me})`;
    show($(H, '.sug'), vis(t, -1, b(33.5), .09, .22, .15));
    const dv = vis(t, b(33.9), b(34.8), .02, .14, .08); show($(H, '.dots'), dv);
    $$(H, '.dots i').forEach((el, i) => { el.style.transform = `translateY(${-6 * Math.max(0, Math.sin((t * 7 - i * .8)))}px)`; });
    const av = vis(t, b(34.8), T + 1, 0, .2); show($(H, '.ans'), av, .5);
    const n = Math.floor(clamp((t - b(34.9)) / 1.25) * ANSWER.length), tx = $(H, '.tx'), st = ANSWER.slice(0, n);
    if (tx.textContent !== st) tx.textContent = st;
    const cv = vis(t, b(37) - .1, T + 1, 0, .24); show($(H, '.acard'), cv, .5); $(H, '.acard').style.transform = `translateY(${(1 - cv.o) * 18}px)`;
  }

  // cursor
  const sx = 720 + trCX(t) * cam, sy = 720 + (trCY(t) - camY) * cam;
  cursor.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px) scale(${trCurS(t).toFixed(4)}) translate(-3px,-3px)`;
}

window.T = T; window.BEAT = BEAT; window.seek = seek;
window.EVENTS = { clicks, drags: [], keys: keyTimes, hovers: [b(0.8), b(22.3)], toggle: b(3), success: [b(10), b(27)] };
const qp = new URLSearchParams(location.search);
if (qp.has('t')) seek(+qp.get('t'));
else if (qp.has('play')) { const t0 = performance.now(); const loop = () => { seek((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
else seek(0);
