from pathlib import Path
p=Path('player/js/drive.js')
s=p.read_text()

old='    if (window.fileAsyncCache.hasOwnProperty(mappingKey)) return callback();'
new=old+"\n    try { const mv=mappingValue; if(mv){ const fp='/game/'+mv.split('?')[0]; if(FS.analyzePath(fp).exists && FS.stat(fp).size>1){ window.fileAsyncCache[mappingKey]=1; return callback(); } } } catch(e) {}"
if s.count(old)!=1:
    raise SystemExit('loadFileAsync cache marker mismatch')
s=s.replace(old,new,1)

a=s.index('window.saveFile = function(filename, localOnly) {')
b=s.index('\n};',a)+3
save="""window.saveFile = function(filename, localOnly) {
    const fpath='/game/'+filename;
    if(!FS.analyzePath(fpath).exists) return Promise.resolve(false);
    const buf=FS.readFile(fpath);
    return localforage.setItem(namespace+filename,buf)
      .then(()=>localforage.getItem(namespace))
      .then(folder=>{
        folder=folder||{};
        folder[filename]={t:Number(FS.stat(fpath).mtime)};
        return localforage.setItem(namespace,folder);
      })
      .then(()=>{
        if(!localOnly)(window.saveCloudFile||(()=>{}))(filename,buf);
        console.log('SLSAVED|'+filename);
        return true;
      })
      .catch(e=>{console.error('SLSAVEERR',e);return false;});
};

window.restoreLocalFilesBeforeRun=function(){
    const dep='sl-local-saves';
    addRunDependency(dep);
    try{if(!FS.analyzePath('/game').exists)FS.mkdir('/game');}catch(e){}
    localforage.getItem(namespace)
      .then(folder=>Promise.all(Object.keys(folder||{}).map(key=>
        localforage.getItem(namespace+key).then(res=>{
          if(!res)return;
          const f='/game/'+key;
          try{if(FS.analyzePath(f).exists)FS.unlink(f);}catch(e){}
          FS.writeFile(f,res);
          const m=folder[key];
          if(m&&Number.isInteger(m.t))FS.utime(f,m.t,m.t);
        })
      )))
      .then(()=>{console.log('SLRESTORE|done');removeRunDependency(dep);})
      .catch(e=>{console.error('SLRESTOREERR',e);removeRunDependency(dep);});
};
"""
p.write_text(s[:a]+save+s[b:])
print('DRIVE_V148_OK')
