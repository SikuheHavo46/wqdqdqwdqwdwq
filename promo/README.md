# Карьерный навигатор — motion

20 s seamless loop (1440×1440, 60 fps, 120 BPM, 10 bars) that walks a user through navprofr.ru:
главная → регистрация (имя, логин, пароль, роль) → «Профиль создан» → личный кабинет → диагностика
«Интересы и склонности» → «Сильные направления» (ТОП-3) → профпробы Академии → запись на слот →
«Вы записаны» → образовательный маршрут → ИИ-помощник → главная.

Copy, screens and styles come from the site's production bundle (Next.js page chunks) and computed styles:
`#f5f5f7` / `#1d1d1f` / accent `#0071e3`, Inter, pill buttons. The user name, answers and ТОП-3 scores are demo data.

- `index.html`: single self-contained file (fonts inlined). `index.html?play` plays live, `?t=7.5` freezes a moment.
  `seek(t)` is a pure function of time (closed-form spring sums; no CSS transitions or timers).
- `motion.js` + `src.html`: sources; `python build.py` produces `index.html`.
- `beats.py`: one frame per beat (or `beats.py 7.55 8.2 …`) for layout checks.
- `audio.py`: cuts 10 bars on a downbeat, stretches 122 → 120 BPM, places click/typing/success sounds by measured peak.
- `render.py`: 4 subframes per frame via Playwright → ffmpeg `tmix` → `out/navprofr-motion.mp4`.

Rebuild: `uv venv && uv pip install numpy playwright && playwright install chromium`, download
`https://assets.mixkit.co/music/130/130.mp3` to `cand/130.mp3`, then `python build.py && python render.py all`
(`render.py events`, `audio.py`, `render.py frames`, `render.py encode` run the steps separately).

Music: "Tech House vibes" by Alejandro Magaña, Mixkit free license (not redistributed here). Font: Inter (SIL OFL).
