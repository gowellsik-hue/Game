from pathlib import Path
p=Path('fairy_player/index.html'); s=p.read_text()
if "slknight_v14_engine" not in s: raise SystemExit('Knight namespace marker missing in Fairy template')
s=s.replace("slknight_v14_engine","slfairy_v1_engine")
s=s.replace("SLKnight V14.7","SLFairy V14.7")
s=s.replace("?v=v147","?v=v147")
p.write_text(s)
d=Path('fairy_player/js/dpad.js'); t=d.read_text()
if "bindKey('sl-bag', 83);" not in t or "bindKey('sl-equip', 65);" not in t:
    raise SystemExit('Fairy mobile input template mismatch')
print('FAIRY_BROWSER_IDENTITY_OK')
