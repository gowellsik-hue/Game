#!/usr/bin/env python3
from pathlib import Path
import struct, sys

MASK=0xffffffff
DEFAULT_KEY=0xDEADCAFE

def rot(k): return ((k*7)+3)&MASK

def decrypt_archive(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    with src.open('rb') as f:
        hdr=f.read(8)
        if hdr[:7] != b'RGSSAD\0' or len(hdr)!=8 or hdr[7] != 1:
            raise ValueError(f'unsupported RGSSAD header: {hdr!r}')
        key=DEFAULT_KEY
        count=0
        while True:
            raw=f.read(4)
            if not raw: break
            if len(raw)!=4: raise EOFError('truncated filename length')
            n=struct.unpack('<I', raw)[0] ^ key
            key=rot(key)
            if n>4096: raise ValueError(f'bad filename length {n} at entry {count}')
            enc=f.read(n)
            if len(enc)!=n: raise EOFError('truncated filename')
            name_b=bytearray(enc)
            for i in range(n):
                name_b[i] ^= key & 0xff
                key=rot(key)
            raw=f.read(4)
            if len(raw)!=4: raise EOFError('truncated file length')
            size=struct.unpack('<I', raw)[0] ^ key
            key=rot(key)
            try:
                name=bytes(name_b).decode('cp949')
            except UnicodeDecodeError:
                try: name=bytes(name_b).decode('utf-8')
                except UnicodeDecodeError: name=bytes(name_b).decode('latin1')
            name=name.replace('\\','/')
            parts=[p for p in name.split('/') if p not in ('','.','..')]
            if not parts: raise ValueError('empty/unsafe path')
            target=out.joinpath(*parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            data_key=key
            counter=0
            remaining=size
            with target.open('wb') as w:
                while remaining:
                    chunk=bytearray(f.read(min(1<<20, remaining)))
                    if not chunk: raise EOFError(f'truncated data for {name}')
                    for i in range(len(chunk)):
                        chunk[i] ^= data_key.to_bytes(4,'little')[counter]
                        counter=(counter+1)&3
                        if counter==0: data_key=rot(data_key)
                    w.write(chunk)
                    remaining -= len(chunk)
            count += 1
            if count <= 8 or count % 250 == 0:
                print(f'RGSSAD_EXTRACT {count}: {name} ({size} bytes)')
    print(f'RGSSAD_EXTRACT_OK files={count}')

def make_test(path: Path, files):
    with path.open('wb') as f:
        f.write(b'RGSSAD\0\x01')
        key=DEFAULT_KEY
        for name,data in files:
            nb=name.encode('cp949')
            f.write(struct.pack('<I',len(nb)^key)); key=rot(key)
            enc=bytearray(nb)
            for i in range(len(enc)):
                enc[i]^=key&0xff; key=rot(key)
            f.write(enc)
            f.write(struct.pack('<I',len(data)^key)); key=rot(key)
            dk=key; ctr=0; encd=bytearray(data)
            for i in range(len(encd)):
                encd[i]^=dk.to_bytes(4,'little')[ctr]
                ctr=(ctr+1)&3
                if ctr==0: dk=rot(dk)
            f.write(encd)

def selftest(tmp: Path):
    src=tmp/'test.rgssad'; out=tmp/'out'
    files=[('Data\\Scripts.rxdata',b'abc\x00xyz'),('Graphics\\Icons\\용기.png',bytes(range(256))*3),('Audio\\SE\\test.wav',b'RIFF'+b'Z'*101)]
    make_test(src,files); decrypt_archive(src,out)
    for name,data in files:
        p=out.joinpath(*name.replace('\\','/').split('/'))
        assert p.read_bytes()==data,(name,len(p.read_bytes()),len(data))
    print('RGSSAD_SELFTEST_OK')

if __name__=='__main__':
    if len(sys.argv)==2 and sys.argv[1]=='--selftest':
        import tempfile
        with tempfile.TemporaryDirectory() as d: selftest(Path(d))
    elif len(sys.argv)==3:
        decrypt_archive(Path(sys.argv[1]),Path(sys.argv[2]))
    else:
        raise SystemExit('usage: rgssad_extract.py ARCHIVE OUTDIR | --selftest')
