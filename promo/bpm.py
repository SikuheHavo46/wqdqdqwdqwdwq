import numpy as np, subprocess, sys
SR=22050
def load(p):
    b=subprocess.run(['ffmpeg','-v','quiet','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(b,np.float32)
def onset(x,hop=256,n=1024):
    w=np.hanning(n); fr=np.lib.stride_tricks.sliding_window_view(x,n)[::hop]*w
    S=np.log1p(10*np.abs(np.fft.rfft(fr,axis=1)))
    f=np.maximum(0,np.diff(S,axis=0)).sum(1); f=f-np.convolve(f,np.ones(16)/16,'same'); return np.maximum(f,0), SR/hop
def tempo(env,fps,lo=90,hi=150):
    e=env-env.mean(); ac=np.correlate(e,e,'full')[len(e)-1:]
    best=None
    for bpm in np.arange(lo,hi,0.05):
        L=60*fps/bpm; s=sum(np.interp(L*k,np.arange(len(ac)),ac)/k**0.3 for k in (1,2,4,8))
        if best is None or s>best[1]: best=(bpm,s)
    return best[0], best[1]/ac[0]
if __name__=='__main__':
    for p in sys.argv[1:]:
        x=load(p); 
        if len(x)<SR*10: print(p,'bad'); continue
        env,fps=onset(x[:SR*90]); b,c=tempo(env,fps); print(f"{p}\t{len(x)/SR:.0f}s\tbpm={b:.2f}\tclarity={c:.3f}")
