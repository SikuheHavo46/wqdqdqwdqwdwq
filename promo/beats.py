"""Render one frame per beat (plus arbitrary times) to check layout on the grid."""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

root = pathlib.Path(__file__).parent
out = root / "out" / "beats"


async def main(times):
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1440})
        await pg.goto((root / "index.html").as_uri())
        await pg.evaluate("window.READY")
        await pg.evaluate("seek(0)"); await pg.screenshot()
        for name, t in times:
            await pg.evaluate(f"seek({t})")
            await pg.screenshot(path=str(out / f"{name}.png"))
        await br.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        ts = [(f"t{float(a):06.3f}", float(a)) for a in sys.argv[1:]]
    else:
        ts = [(f"b{i:02d}", i * 0.5 + 0.42) for i in range(96)]  # just before the next beat: settled state
    asyncio.run(main(ts))
    print("ok", len(ts))
