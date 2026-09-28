from pathlib import Path
import subprocess,sys
root=Path('fairy_player/gameasync/Audio')
exts={'.mp3','.wav','.wma','.aac','.m4a','.flac','.mid','.midi'}
failures=[]; converted=0
if root.exists():
    for src in [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in exts]:
        out=src.with_suffix('.ogg'); temp=None
        try:
            inp=src
            if src.suffix.lower() in {'.mid','.midi'}:
                temp=src.with_name(src.name+'.wav')
                subprocess.run(['timidity',str(src),'-Ow','-o',str(temp)],check=True)
                inp=temp
            subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(inp),'-c:a','libvorbis','-q:a','4',str(out)],check=True)
            if not out.exists() or out.stat().st_size==0: raise RuntimeError('empty output')
            if temp and temp.exists(): temp.unlink()
            if src!=out and src.exists(): src.unlink()
            converted+=1
        except Exception as e:
            failures.append((str(src),str(e)))
            if temp and temp.exists(): temp.unlink()
if failures:
    for f,e in failures: print(f+' -> '+e,file=sys.stderr)
    raise SystemExit(1)
gfx=Path('fairy_player/gameasync/Graphics')
for src in [p for p in gfx.rglob('*') if p.is_file() and p.suffix.lower() in {'.bmp','.gif','.webp','.tif','.tiff'}]:
    out=src.with_suffix('.png')
    subprocess.run(['convert',str(src)+'[0]',str(out)],check=True)
    if not out.exists() or out.stat().st_size==0: raise SystemExit('image conversion failed: '+str(src))
    src.unlink()
print('FAIRY_AUDIO_CONVERTED='+str(converted))
