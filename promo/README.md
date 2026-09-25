# Карьерный навигатор — motion

48 s seamless loop (1440×1440, 60 fps, 120 BPM, 24 bars; one story beat = 1.5 music beats) that walks a user through navprofr.ru along the
site's own «Четыре спокойных шага». The site header morphs into a step bar (Вход · Диагностика · Пробы · Работа)
that ticks off each step; every step opens with a title card using the site's copy.

| Story beats | Screen |
|---|---|
| 0–2 | Главная: «Карьерный навигатор», курсор жмёт «Начать» |
| 2–13 | Шаг 01 «Профиль за минуту» → регистрация (создать аккаунт, имя, логин, пароль, роль) → «Профиль создан» |
| 14–25 | Шаг 02 «Сильные направления» → диагностика (2 вопроса) → «Считаем результат…» → ТОП-3 |
| 25–33 | Шаг 03 «Опыт на практике» → профпробы Академии → запись на слот → «Вы записаны» |
| 34–50 | Шаг 04 «Реальные вакансии» → поиск стажировок → «Спросить помощника» → пилюля «Карьерный AI-помощник» → чат |
| 50–58 | Личный кабинет: 4 из 4, «Один профиль. Весь путь.», navprofr.ru |
| 58–64 | Возврат на главную (цикл) |

Copy, screens and styles come from the site's production bundle (Next.js page chunks) and computed styles:
`#f5f5f7` / `#1d1d1f` / accent `#0071e3`, Inter, pill buttons. The user, answers, ТОП-3 names/scores and vacancies are demo data.

- `index.html`: single self-contained file (fonts inlined). `index.html?play` plays live, `?t=7.5` freezes a moment.
  `seek(t)` is a pure function of time (closed-form spring sums; no CSS transitions, timers or carried state).
- `motion.js` + `src.html`: sources; `python build.py` produces `index.html`.
- `beats.py`: one frame per beat (or `beats.py 7.55 8.2 …`, in seconds) for layout checks.
- `audio.py`: cuts 24 bars on a downbeat, stretches 122 → 120 BPM, places clicks, typing, ticks, swishes and chimes by measured peak.
- `render.py`: 4 subframes per frame via Playwright → ffmpeg `tmix` → `out/navprofr-motion.mp4`.

Rebuild: `uv venv && uv pip install numpy playwright && playwright install chromium`, download
`https://assets.mixkit.co/music/130/130.mp3` to `cand/130.mp3`, then `python build.py && python render.py all`
(`render.py events`, `audio.py`, `render.py frames`, `render.py encode` run the steps separately).

Music: "Tech House vibes" by Alejandro Magaña, Mixkit free license (not redistributed here). Font: Inter (SIL OFL).
