from pathlib import Path
import json,re

root=Path('player/gameasync')
groups={'data':[],'gfx':[],'audio':[]}
pictures=[]

def key_for(rel):
    return re.sub(r'\.[^/.]+$','',rel.lower())

for p in root.rglob('*'):
    if not p.is_file():
        continue
    if p.name.lower()=='thumbs.db':
        continue
    rel=p.relative_to(root).as_posix()
    low=rel.lower()

    if low.startswith('graphics/pictures/'):
        pictures.append(rel)
        continue

    if low in ('rgss.rb','game.ini','lineage.ini') or low.startswith('data/') or low.startswith('fonts/'):
        groups['data'].append((rel,p))
    elif low.startswith((
        'graphics/animations/','graphics/autotiles/','graphics/characters/',
        'graphics/fogs/','graphics/gameovers/','graphics/icons/',
        'graphics/panoramas/','graphics/tilesets/','graphics/titles/',
        'graphics/windowskins/'
    )):
        groups['gfx'].append((rel,p))
    elif low.startswith(('audio/se/','audio/bgs/','audio/me/','bm/')):
        groups['audio'].append((rel,p))

packs=[]
for name,files in groups.items():
    files.sort(key=lambda x:x[0].lower())
    manifest=[]
    offset=0
    outpath=Path('player')/('core-'+name+'.pack')
    with outpath.open('wb') as out:
        for rel,p in files:
            data=p.read_bytes()
            out.write(data)
            manifest.append([rel,offset,len(data),key_for(rel)])
            offset+=len(data)
    packs.append({'name':name,'url':'core-'+name+'.pack?v=v147','bytes':offset,'files':manifest})
    print('CORE_PACK',name,'files',len(files),'bytes',offset)

pictures.sort(key=str.lower)
js='window.slCorePacks='+json.dumps(packs,ensure_ascii=False,separators=(',',':'))+';\n'
js+='window.slPicturePreload='+json.dumps(pictures,ensure_ascii=False,separators=(',',':'))+';\n'
Path('player/core-manifest.js').write_text(js,encoding='utf-8')

total=sum(x['bytes'] for x in packs)
print('BLOCKING_CORE_BYTES='+str(total))
if total<=0 or total>60*1024*1024:
    raise SystemExit('blocking core size out of expected range: '+str(total))
