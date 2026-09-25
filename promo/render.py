"""Render 4 subframes per output frame with Playwright, blend with ffmpeg tmix -> 60 fps, mux audio.

Subframe i is sampled at (i - 1.5) / 240 s, so each 60 fps frame averages a shutter centred on its own
time; times wrap around the loop, so the first frame blends with the end and the loop stays seamless.
"""
import asyncio, json, pathlib, subprocess, sys
from playwright.async_api import async_playwright

root = pathlib.Path(__file__).parent
FPS, SUB, T = 60, 4, 14.0
N = int(T * FPS * SUB)
sub = root / "out" / "sub"
WORKERS = 4


async def worker(p, ids):
    br = await p.chromium.launch()
    pg = await br.new_page(viewport={"width": 1440, "height": 1440})
    await pg.goto((root / "index.html").as_uri())
    await pg.evaluate("document.fonts.ready")
    for i in ids:
        f = sub / f"{i:05d}.png"
        if f.exists():
            continue
        await pg.evaluate(f"seek({(i - 1.5) / (FPS * SUB)})")
        await pg.screenshot(path=str(f))
    await br.close()


async def events():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto((root / "index.html").as_uri())
        (root / "out").mkdir(exist_ok=True)
        (root / "out" / "events.json").write_text(json.dumps(await pg.evaluate("EVENTS")))
        await br.close()


async def frames():
    sub.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        await asyncio.gather(*(worker(p, list(range(k, N, WORKERS))) for k in range(WORKERS)))


def encode():
    video = root / "out" / "navprofr-motion.mp4"
    vf = f"tmix=frames={SUB},select='eq(mod(n\\,{SUB})\\,{SUB - 1})',setpts=N/{FPS}/TB,format=yuv420p"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS * SUB), "-i", str(sub / "%05d.png"),
                    "-i", str(root / "out" / "audio.wav"), "-vf", vf, "-r", str(FPS),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-tune", "animation", "-movflags", "+faststart",
                    "-c:a", "aac", "-b:a", "256k", "-t", str(T), str(video)], check=True)
    print(video)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("events", "all"):
        asyncio.run(events())
    if cmd in ("frames", "all"):
        asyncio.run(frames())
    if cmd in ("encode", "all"):
        encode()
