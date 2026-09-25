import numpy as np, sys
from bpm import load, SR
def env_hi(x,hop=64,n=1024):
    w=np.hanning(n); fr=np.lib.stride_tricks.sliding_window_view(x,n)[::hop]*w
    S=np.log1p(10*np.abs(np.fft.rfft(fr,axis=1)))
    f=np.maximum(0,np.diff(S,axis=0)).sum(1); f-=np.convolve(f,np.ones(64)/64,'same'); return np.maximum(f,0), SR/hop
def fit(env,fps,lo,hi):
    t=np.arange(len(env))/fps; best=(0,0,0)
    for bpm in np.arange(lo,hi,0.01):
        P=60/bpm; ph=np.exp(2j*np.pi*t/P); z=(env*ph).sum()/env.sum()
        if abs(z)>best[1]: best=(bpm,abs(z),(-np.angle(z))/(2*np.pi)*P % P)
    return best
for p in sys.argv[1:]:
    x=load(p); env,fps=env_hi(x); b,s,off=fit(env,fps,110,130)
    # section-wise strength per bar to find where full drums play
    P=60/b; nb=int((len(x)/SR-off)/(4*P))
    rms=[float(np.sqrt(np.mean(x[int((off+4*P*i)*SR):int((off+4*P*(i+1))*SR)]**2))) for i in range(nb)]
    print(p,f"bpm={b:.2f} coh={s:.3f} firstbeat={off:.3f}s bars={nb}")
    print(' bar rms:',' '.join(f"{r:.2f}" for r in rms))
