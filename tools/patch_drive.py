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

window.preloadCorePacks=function(){
    const dep='sl-core-packs';
    addRunDependency(dep);
    const packs=window.slCorePacks||[];
    const box=document.getElementById('progress');
    const xh=[];
    let finished=false;
    let globalLoaded={};
    let globalTotal={};

    function setProgress(){
      let loaded=0,total=0;
      Object.keys(globalLoaded).forEach(k=>loaded+=globalLoaded[k]||0);
      Object.keys(globalTotal).forEach(k=>total+=globalTotal[k]||0);
      if(box){
        const a=(loaded/1048576).toFixed(1);
        const b=total?(total/1048576).toFixed(1):'?';
        box.innerHTML='Loading game data '+a+' / '+b+' MB';
        box.style.opacity='0.8';
      }
    }

    function finish(msg){
      if(finished)return;
      finished=true;
      xh.forEach(x=>{try{x.abort();}catch(e){}});
      window.fileLoadedAsync=function(file){document.title=wTitle;};
      if(box){box.innerHTML=msg;box.style.opacity='0.65';}
      console.log('SLCORE_DONE|'+msg);
      removeRunDependency(dep);
    }

    function loadPack(pack){
      return new Promise(resolve=>{
        const x=new XMLHttpRequest();
        xh.push(x);
        x.open('GET',pack.url,true);
        x.responseType='arraybuffer';
        x.timeout=60000;
        globalLoaded[pack.name]=0;
        globalTotal[pack.name]=pack.bytes||0;

        x.onprogress=e=>{
          globalLoaded[pack.name]=e.loaded||0;
          if(e.lengthComputable&&e.total)globalTotal[pack.name]=e.total;
          setProgress();
        };

        function fallback(reason){
          console.error('SLCORE_FALLBACK|'+pack.name+'|'+reason);
          resolve(false);
        }

        x.onerror=()=>fallback('network');
        x.ontimeout=()=>fallback('timeout');
        x.onload=()=>{
          if(x.status<200||x.status>=400||!x.response)return fallback('http'+x.status);
          try{
            const u=new Uint8Array(x.response);
            for(const q of pack.files){
              const rel=q[0],off=q[1],len=q[2],key=q[3],full='/game/'+rel;
              if(off+len>u.length)throw new Error('short pack '+pack.name);
              try{if(FS.analyzePath(full).exists)FS.unlink(full);}catch(e){}
              const slash=full.lastIndexOf('/');
              const dir=full.slice(0,slash);
              try{if(FS.mkdirTree)FS.mkdirTree(dir);}catch(e){}
              FS.writeFile(full,u.subarray(off,off+len));
              window.fileAsyncCache[key]=1;
            }
            globalLoaded[pack.name]=u.length;
            setProgress();
            console.log('SLCORE_READY|'+pack.name+'|'+u.length);
            resolve(true);
          }catch(e){
            console.error(e);
            fallback('unpack');
          }
        };
        x.send();
      });
    }

    const hard=setTimeout(()=>finish('Core preload timeout - lazy mode'),90000);
    Promise.all(packs.map(loadPack))
      .then(results=>{
        clearTimeout(hard);
        finish(results.every(Boolean)?'Game ready':'Game ready - lazy fallback');
      })
      .catch(e=>{
        clearTimeout(hard);
        console.error('SLCOREERR',e);
        finish('Game ready - lazy fallback');
      });
};

window.slWarmPictures=function(){
    const queue=(window.slPicturePreload||[]).slice();
    let active=0;
    const limit=3;

    function next(){
      while(active<limit&&queue.length){
        const file=queue.shift();
        const mappingKey=getMappingKey(file);
        const mappingValue=mapping[mappingKey];
        if(!mappingValue||window.fileAsyncCache[mappingKey])continue;
        const path='/game/'+mappingValue.substring(0,mappingValue.lastIndexOf('/'));
        const filename=mappingValue.substring(mappingValue.lastIndexOf('/')+1).split('?')[0];
        active++;
        getLazyAsset('gameasync/'+mappingValue,filename,(data)=>{
          if(!data){active--;next();return;}
          FS.createPreloadedFile(path,filename,new Uint8Array(data),true,true,function(){
            window.fileAsyncCache[mappingKey]=1;
            active--;next();
          },function(){
            active--;next();
          },false,false,()=>{
            try{FS.unlink(path+'/'+filename);}catch(e){}
          });
        },true);
      }
    }
    next();
};
"""
p.write_text(s[:a]+save+s[b:])
