# Карьерный навигатор — motion loop

A 14 s square (1440×1440, 60 fps) seamless UI-motion loop for navprofr.ru: one shape morphs through 12 states
on a 120 BPM, 7-bar grid (button → loader → check → island → player → slider → toggle → tabs → chart → ⌘K →
palette → toast → button).

- `index.html`: the single self-contained file (fonts inlined). Open `index.html?play` to watch it live or
  `index.html?t=7.5` to freeze a moment. `seek(t)` is a pure function of time.
- `motion.js` + `src.html`: sources; `python build.py` produces `index.html`.
- `beats.py`: one frame per beat (or `beats.py 7.55 8.2 …`) for layout checks.
- `audio.py`: cuts 7 bars on a downbeat, stretches 122 → 120 BPM, places UI sounds by their measured peaks.
- `render.py`: 4 subframes per frame via Playwright, ffmpeg `tmix` → `out/navprofr-motion.mp4`.

Rebuild: `uv venv && uv pip install numpy playwright && playwright install chromium`, download the track to
`cand/130.mp3` (`https://assets.mixkit.co/music/130/130.mp3`), then `python build.py && python render.py events &&
python audio.py && python render.py frames && python render.py encode`.

Music: "Tech House vibes" by Alejandro Magaña, Mixkit free license (commercial use, no attribution required;
the raw track is not redistributed here). Font: Geist (SIL OFL).
