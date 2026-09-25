"""Cut 7 bars of the track on a downbeat, stretch to exactly 120 BPM, and mix UI sounds by measured peak.

Track: "Tech House vibes" by Alejandro Magaña (Mixkit, free license), https://mixkit.co/free-stock-music/
"""
import json, pathlib, subprocess, sys, wave
import numpy as np

SR = 48000
root = pathlib.Path(__file__).parent
SRC = root / "cand" / "130.mp3"
SRC_BPM = 122.0          # measured from the kick envelope (grid.py / bpm.py)
SRC_PHASE = 0.1205       # first kick-grid beat (s)
START_BEAT = 65          # downbeat (index % 4 == 1) at the top of an 8-bar phrase inside the steady section
BEAT, T = 0.5, 32.0


def load(path, sr=SR, filt=None):
    cmd = ["ffmpeg", "-v", "quiet", "-i", str(path)] + (["-af", filt] if filt else []) + ["-ac", "2", "-ar", str(sr), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()


def kick_env(mono, sr=SR, hop=64, n=2048):
    fr = np.lib.stride_tricks.sliding_window_view(mono, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1)); f = np.fft.rfftfreq(n, 1 / sr)
    return S[:, (f > 35) & (f < 140)].sum(1), sr / hop, n / 2 / sr


def beat_peaks(stereo, n_beats, sr=SR):
    """Measured kick peak time near each grid beat (s)."""
    e, fps, lag = kick_env(stereo.mean(1), sr)
    out = []
    for k in range(n_beats):
        c = int((k * BEAT - lag) * fps); w = int(.06 * fps)
        lo = max(0, c - w); seg = e[lo:c + w]
        out.append((lo + int(np.argmax(seg))) / fps + lag if len(seg) else np.nan)
    return np.array(out)


def music():
    ratio = 120.0 / SRC_BPM
    t0 = SRC_PHASE + START_BEAT * 60 / SRC_BPM
    pad = 1.0
    # stretch a padded window, then trim so the measured kick peaks sit on the 0.5 s grid
    x = load(SRC, filt=f"atrim=start={t0 - pad}:duration={T * (SRC_BPM / 120) + 2 * pad},asetpts=N/SR/TB,atempo={ratio:.6f}")
    off = pad / ratio
    seg = lambda o: x[int(round(o * SR)):int(round(o * SR)) + int(T * SR)]
    shift = float(np.nanmedian(beat_peaks(seg(off), 64) - np.arange(64) * BEAT))
    off += shift
    y = seg(off).copy()
    return y, beat_peaks(y, 64) - np.arange(64) * BEAT, shift


# ---- UI sounds (mono) ----
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-np.maximum(t - a, 0) / d)


def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def snd_click(seed=1, pitch=2300, g=1.0):
    n = int(.05 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * pitch * t) * env(n, .0006, .006)
    tick = bandpass(np.random.default_rng(seed).standard_normal(n), 2500, 9000) * env(n, .0003, .0025)
    return g * (.55 * body + .35 * tick / (np.abs(tick).max() + 1e-9))


def snd_key(seed):
    return snd_click(seed, pitch=3200 + 150 * (seed % 3), g=.55)


def snd_pop():
    n = int(.09 * SR); t = np.arange(n) / SR
    f = 520 + 380 * (1 - np.exp(-t / .012))
    return .8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .03)


def snd_soft(g=.45):
    n = int(.06 * SR); t = np.arange(n) / SR
    return g * np.sin(2 * np.pi * 1400 * t) * env(n, .001, .012)


def snd_chime():
    n = int(.5 * SR); t = np.arange(n) / SR
    a = np.sin(2 * np.pi * 1318.5 * t) * env(n, .002, .16)
    b = np.sin(2 * np.pi * 1975.5 * t) * env(n, .002, .12)
    k = int(.06 * SR); b = np.concatenate([np.zeros(k), b[:-k]])
    return .32 * (a + .8 * b)


def snd_swish():
    """Soft air swish for chapter cards: band-passed noise with a rising centre, gentle attack."""
    n = int(.34 * SR); t = np.arange(n) / SR
    x = np.random.default_rng(7).standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X[(f < 700) | (f > 7000)] = 0
    x = np.fft.irfft(X, n) * np.sin(np.pi * np.clip(t / .34, 0, 1)) ** 2 * (0.4 + 0.6 * t / .34)
    return .35 * x / np.abs(x).max()


def peak_index(s):
    return int(np.argmax(np.convolve(np.abs(s), np.ones(48) / 48, "same")))


def place(buf, s, t):
    """Put sound s so that its measured peak lands at time t (wraps around the loop)."""
    i0 = int(round(t * SR)) - peak_index(s)
    np.add.at(buf, (np.arange(len(s)) + i0) % len(buf), s)


def main():
    y, dev, shift = music()
    ev = json.loads((root / "out" / "events.json").read_text())
    ui = np.zeros(len(y)); n_snd = 0
    for i, t in enumerate(ev["clicks"]):
        place(ui, snd_click(i), t); n_snd += 1
    for i, t in enumerate(ev["keys"]):
        place(ui, snd_key(i), t); n_snd += 1
    for t in ev["hovers"]:
        place(ui, snd_soft(.22), t); n_snd += 1
    for t in ev["ticks"]:
        place(ui, snd_pop() * .5, t); n_snd += 1
    for t in ev["whoosh"]:
        place(ui, snd_swish(), t); n_snd += 1
    for t in ev["success"]:
        place(ui, snd_chime(), t); n_snd += 1
    mix = y * .78 + ui[:, None] * .5
    # loop seam: 20 ms equal-power blend of the tail into the head so the wrap is click-free
    n = int(.02 * SR); w = np.linspace(0, 1, n)[:, None]
    mix[:n] = mix[:n] * np.sqrt(w) + mix[-n:] * np.sqrt(1 - w)
    peak = np.abs(mix).max(); mix *= min(1.0, .89 / peak)
    with wave.open(str(root / "out" / "audio.wav"), "wb") as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"trim shift {shift * 1000:+.1f} ms; kick peaks vs grid: median |dev| {np.nanmedian(np.abs(dev)) * 1000:.1f} ms, max {np.nanmax(np.abs(dev)) * 1000:.1f} ms")
    print(f"UI sounds placed by peak: {n_snd}; mix peak before normalise {peak:.2f}")


if __name__ == "__main__":
    sys.exit(main())
