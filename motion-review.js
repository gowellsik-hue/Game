(() => {
'use strict';
const root=document.getElementById('reviewPanel');
const world=window.SANCTUARY_MANIFEST,pack=window.SANCTUARY_MONSTER_PACK;
if(!root||!world||!pack)return;
const actions=['idle','walk','attack','hit','death'];
const names={idle:'대기',walk:'이동',attack:'공격',hit:'피격',death:'사망'};
const bases={idle:32,walk:0,attack:8,hit:16,death:24};
const KEY='sanctuary-v16-review-v2',OLD='sanctuary-v14-orc-review-v1',OLDMODE='sanctuary-v15-reviewed-trial-mode';
const el=id=>document.getElementById(id),actorKeys=Object.keys(world.actors).filter(x=>x!=='hero');
const candidates=Object.fromEntries(actorKeys.filter(x=>pack.actors?.[x]&&pack.actors[x].sprite_id===world.actors[x].sprite_id).map(x=>[x,pack.actors[x]]));
const sourceRun=id=>candidates[id]?.sourceRun??pack.sourceRun;
const hasRow=(id,mode,dir)=>Boolean(candidates[id]?.actions?.[mode]?.directions?.[dir]?.frames?.length);
const validKey=k=>/^(idle|walk|attack|hit|death):[0-7]$/.test(k);
const validDecision=d=>d==='ok'||d==='question';
const decisions={},modes={};
for(const id of actorKeys){decisions[id]={};modes[id]='legacy'}
function takeReviews(data){
 if(!data||data.schema!=='sanctuary.motion-review.v2'||!data.actors||typeof data.actors!=='object')return false;
 let found=0;
 for(const [id,item] of Object.entries(data.actors)){
  if(!candidates[id]||item?.spriteId!==world.actors[id].sprite_id||item.sourceRun!==sourceRun(id))continue;
  const next={};
  for(const [key,val] of Object.entries(item.decisions||{})){
   if(validKey(key)&&validDecision(val)&&hasRow(id,...[key.split(':')[0],Number(key.split(':')[1])]))next[key]=val;
  }
  decisions[id]=next;found++;
 }
 return found>0;
}
function legacyReview(data){
 if(data?.schema!=='sanctuary.motion-review.v1'||data.spriteId!==56||data.sourceRun!==sourceRun('mob56')||!candidates.mob56)return false;
 const next={};
 for(const [key,value] of Object.entries(data.decisions||{})){
  if(validKey(key)&&validDecision(value)&&hasRow('mob56',key.split(':')[0],Number(key.split(':')[1])))next[key]=value;
 }
 decisions.mob56=next;return true;
}
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||'null');
 if(saved?.schema==='sanctuary.motion-trial.v2'){
  takeReviews(saved.review);
  for(const [id,mode] of Object.entries(saved.modes||{}))if(candidates[id]&&['legacy','approved','all'].includes(mode))modes[id]=mode;
 }else{
  const old=JSON.parse(localStorage.getItem(OLD)||'null');if(old)legacyReview(old);
  const mode=localStorage.getItem(OLDMODE);
  if(candidates.mob56&&['legacy','approved','all'].includes(mode))modes.mob56=mode;
  else if(candidates.mob56&&localStorage.getItem('sanctuary-v12-monster-pack-on')==='true')modes.mob56='all';
 }
}catch(e){}
function reviewSnapshot(){return {schema:'sanctuary.motion-review.v2',actors:Object.fromEntries(Object.keys(candidates).map(id=>[id,{spriteId:world.actors[id].sprite_id,sourceRun:sourceRun(id),decisions:{...decisions[id]}}]))};}
function snapshot(){return {schema:'sanctuary.motion-trial.v2',version:16,modes:{...modes},review:reviewSnapshot(),warning:'All directions, original action meanings and frame timings require independent confirmation'};}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(snapshot()))}catch(e){}refresh()}
const selector=el('reviewActor'),body=el('reviewBody'),grid=el('reviewGrid');
let current=candidates.mob56?'mob56':actorKeys[0],selectedMode='idle',selectedDir=0,started=0,raf=0;
let framePaused=false,frameStep=0;
const images=new Map(),buttons=new Map(),canvases=[el('reviewOld'),el('reviewNew')];
const contexts=canvases.map(c=>c.getContext('2d'));
for(const id of actorKeys){const opt=document.createElement('option');opt.value=id;opt.textContent='SPR '+world.actors[id].sprite_id+(candidates[id]?' · 추출팩 연결':' · 추출팩 없음');selector.appendChild(opt)}
selector.value=current;
for(const mode of actions){
 const outer=document.createElement('div');outer.className='reviewRow';
 const strong=document.createElement('strong');strong.textContent=names[mode];outer.appendChild(strong);
 const row=document.createElement('div');row.className='reviewSlots';
 for(let dir=0;dir<8;dir++){
  const button=document.createElement('button');button.type='button';button.textContent=String(dir);
  button.setAttribute('aria-label',names[mode]+' 방향 '+dir);button.onclick=()=>select(mode,dir);
  buttons.set(mode+':'+dir,button);row.appendChild(button);
 }
 outer.appendChild(row);grid.appendChild(outer);
}
const position=()=>selectedMode+':'+selectedDir;
const available=()=>hasRow(current,selectedMode,selectedDir);
const status=(id,mode,dir)=>decisions[id]?.[mode+':'+dir]||'none';
const approvedCount=id=>Object.values(decisions[id]||{}).filter(v=>v==='ok').length;
function active(id,mode,dir){
 if(!hasRow(id,mode,dir))return false;
 if(modes[id]==='all')return true;
 return modes[id]==='approved'&&status(id,mode,dir)==='ok';
}
function setMode(mode,id=current){
 if(!candidates[id]||!['legacy','approved','all'].includes(mode))return false;
 modes[id]=mode;persist();return true;
}
function refresh(){
 const id=current,has=Boolean(candidates[id]),review=decisions[id]||{};
 for(const [key,button] of buttons){
  const [mode,d]=key.split(':'),exists=hasRow(id,mode,Number(d));
  button.dataset.review=review[key]||'none';button.dataset.available=exists?'yes':'no';
  button.classList.toggle('selected',key===position());button.setAttribute('aria-pressed',String(key===position()));
 }
 const done=Object.values(review).filter(validDecision).length,ok=approvedCount(id);
 const total=actions.reduce((n,mode)=>n+Array.from({length:8},(_,dir)=>hasRow(id,mode,dir)).filter(Boolean).length,0);
 el('reviewProgress').textContent='SPR '+world.actors[id].sprite_id+' · 검수 '+done+'/'+total+' · 정상 '+ok+' · 의심 '+(done-ok);
 el('reviewCoverage').textContent='원본 몬스터 '+actorKeys.length+'종 중 추출팩 '+Object.keys(candidates).length+'종 연결 · 나머지는 후보 미등록';
 el('reviewOk').disabled=el('reviewQuestion').disabled=!available();
 el('reviewTrialApproved').disabled=el('reviewTrialAll').disabled=!has;
 const label={legacy:'기존 동작',approved:'정상 표시 슬롯만',all:'모든 추출 후보'}[modes[id]||'legacy'];
 el('reviewTrialInfo').textContent='SPR '+world.actors[id].sprite_id+' · '+label+' · 정상 표시 '+ok+'개 · 원본 의미 미확정';
 for(const [mode,key] of [['legacy','reviewTrialLegacy'],['approved','reviewTrialApproved'],['all','reviewTrialAll']]){
  el(key).dataset.active=String(modes[id]===mode);el(key).setAttribute('aria-pressed',String(modes[id]===mode));
 }
}
function select(mode,dir){
 if(!actions.includes(mode)||!Number.isInteger(dir)||dir<0||dir>7)return;
 selectedMode=mode;selectedDir=dir;started=performance.now();frameStep=0;
 const row=candidates[current]?.actions?.[mode]?.directions?.[dir];const base=world.actors[current].actions?.[String(bases[mode]+dir)]||[];
 el('reviewSelection').textContent=names[mode]+' · 방향 '+dir+' · 기존 키 '+(bases[mode]+dir)+' ('+base.length+'장) / 추출 후보 '+(row?.key??'-')+' ('+(row?.frames?.length||0)+'장)';
 el('reviewTiming').textContent=row?'기존 비교속도 110ms · 후보 '+(candidates[current].actions[mode].delayMs||'?')+'ms · 전투 속도와 무관':'추출 후보 없음 · 기존 원본 SPR만 확인 가능';
 refresh();wake();
}
function changeActor(id,syncLab){
 if(!actorKeys.includes(id))return false;
 el('reviewFieldSnapshot').hidden=true;
 current=id;selector.value=id;
 if(syncLab&&el('labActor')?.value!==id){el('labActor').value=id;el('labActor').onchange?.()}
 select('idle',0);return true;
}
function loaded(path){
 if(!path)return null;if(images.has(path))return images.get(path);
 const image=new Image();image.decoding='async';image.src=path;images.set(path,image);
 if(images.size>180)images.delete(images.keys().next().value);return image;
}
function paint(ctx,canvas,frames,delay,t,label,step=null){
 const w=canvas.width,h=canvas.height;ctx.fillStyle='#162b28';ctx.fillRect(0,0,w,h);
 const index=frames.length?(step===null?Math.floor(t/delay):step)%frames.length:0,img=loaded(frames[index]);
 if(img?.complete&&img.naturalWidth>0){const z=Math.min(3.3,(w-12)/img.naturalWidth,(h-28)/img.naturalHeight);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(img,(w-img.naturalWidth*z)/2,(h-img.naturalHeight*z)/2-8,img.naturalWidth*z,img.naturalHeight*z);
 }else{ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#a7baa8';ctx.fillText(frames.length?'원본 PNG 로딩 중':'추출 자료 없음',w/2,h/2)}
 ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillStyle='#f0e1aa';ctx.fillText(label+' · '+(frames.length?index+1+'/'+frames.length:'0'),w/2,h-7);
}
function visible(){return !body.hidden&&!document.hidden&&!el('lab').hidden}
function frameCount(){
 const original=world.actors[current].actions?.[String(bases[selectedMode]+selectedDir)]||[];
 const candidate=candidates[current]?.actions?.[selectedMode]?.directions?.[selectedDir]?.frames||[];
 return Math.max(original.length,candidate.length,1);
}
function loop(t){
 if(!visible()){raf=0;return}
 const row=candidates[current]?.actions?.[selectedMode]?.directions?.[selectedDir],elapsed=framePaused?0:Math.max(0,t-started);
 const original=world.actors[current].actions?.[String(bases[selectedMode]+selectedDir)]||[];
 const candidate=row?.frames||[],newDelay=Math.max(60,Math.min(500,Number(candidates[current]?.actions?.[selectedMode]?.delayMs)||110));
 paint(contexts[0],canvases[0],original,110,elapsed,'기존 원본',framePaused?frameStep:null);
 paint(contexts[1],canvases[1],candidate,newDelay,elapsed,'추출 후보',framePaused?frameStep:null);
 const indexOf=(rows,delay)=>rows.length?(framePaused?frameStep%rows.length:Math.floor(elapsed/delay)%rows.length)+1:0;
 el('reviewFrameStatus').textContent=(framePaused?'프레임 정지 · '+(frameStep+1)+'/'+frameCount():'자동 재생')+' · 기존 '+indexOf(original,110)+'/'+original.length+' · 후보 '+indexOf(candidate,newDelay)+'/'+candidate.length;
 raf=framePaused?0:requestAnimationFrame(loop);
}
function wake(){if(!raf&&visible()){if(!framePaused)started=performance.now();raf=requestAnimationFrame(loop)}}
function stepFrames(delta){
 if(!framePaused){framePaused=true;el('reviewPause').textContent='▶ 재생'}
 frameStep=(frameStep+delta+frameCount())%frameCount();wake();
}
el('reviewPause').onclick=()=>{framePaused=!framePaused;frameStep=0;started=performance.now();el('reviewPause').textContent=framePaused?'▶ 재생':'⏸ 일시정지';wake()};
el('reviewFramePrev').onclick=()=>stepFrames(-1);
el('reviewFrameNext').onclick=()=>stepFrames(1);
function saveFile(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function takeImported(data){
 if(data?.schema==='sanctuary.motion-review.v1')return legacyReview(data);
 if(data?.schema==='sanctuary.motion-review.v2')return takeReviews(data);
 if(data?.schema==='sanctuary.motion-trial.v1'){
  if(!legacyReview(data.review))return false;
  if(['legacy','approved','all'].includes(data.mode))modes.mob56=data.mode;
  return true;
 }
 if(data?.schema==='sanctuary.motion-trial.v2'){
  if(!takeReviews(data.review))return false;
  for(const [id,mode] of Object.entries(data.modes||{}))if(candidates[id]&&['legacy','approved','all'].includes(mode))modes[id]=mode;
  return true;
 }
 return false;
}
function inspectField(snapshot){
 if(!snapshot||!actorKeys.includes(snapshot.actor))return false;
 const mode=actions.includes(snapshot.mode)?snapshot.mode:'idle';
 const dir=Number.isInteger(snapshot.dir)&&snapshot.dir>=0&&snapshot.dir<=7?snapshot.dir:0;
 if(el('lab').hidden)el('labOpen').click();
 if(body.hidden)el('reviewToggle').click();
 changeActor(snapshot.actor,true);select(mode,dir);
 const note=el('reviewFieldSnapshot');note.hidden=false;
 note.textContent=(Number.isFinite(snapshot.time)?'모션 이력 '+snapshot.time.toFixed(2)+'초':'필드 선택 기록')+' · SPR '+world.actors[snapshot.actor].sprite_id+' · '+names[mode]+' · 방향 '+dir+' · 개체 '+String(snapshot.mobId??'?')+' · HP '+String(snapshot.hp??'?')+' · 원본 키 '+String(snapshot.sprKey??'-')+' · '+String(snapshot.source??'검수 시점의 동작');
 el('reviewPanel').scrollIntoView?.({block:'start'});
 wake();return true;
}
el('reviewToggle').onclick=()=>{body.hidden=!body.hidden;el('reviewToggle').textContent=body.hidden?'모션 검수 열기':'검수 화면 접기';wake()};
el('fieldInspect').onclick=()=>inspectField(window.SANCTUARY_GET_FIELD_TARGET?.()||window.SANCTUARY_FIELD_TARGET);
// Field-to-lab history uses the same actor/direction selector as live inspection.
const historySource=()=>window.SANCTUARY_FIELD_HISTORY;
const timeline=el('timelineItems'),timelineBody=el('timelineBody');
let historyAll=false;
const spriteFilter=el('timelineSprite');
for(const id of actorKeys){const option=document.createElement('option');option.value=String(world.actors[id].sprite_id);option.textContent='SPR '+option.value;spriteFilter.appendChild(option)}
function refreshTimeline(){
 const source=historySource(),focus=source?.focus(),all=source?.events(historyAll?'all':'focus',160)||[];
 const mode=el('timelineMode').value||'all',sprite=spriteFilter.value||'all';
 const filtered=all.filter(entry=>(mode==='all'||entry.mode===mode)&&(sprite==='all'||String(entry.spriteId)===sprite));
 const events=filtered.slice(0,40);
 el('timelineStatus').textContent=(historyAll?'전체 몬스터':'마지막 선택 몬스터'+(focus?' · SPR '+focus.spriteId:''))+' · 필터 '+filtered.length+'건 / 기록 '+all.length+'건 · 화면 '+events.length+'건 · 총 '+(source?.length()||0)+'건';
 el('timelineAll').textContent=historyAll?'마지막 선택 몬스터만':'전체 몬스터 보기';
 timeline.replaceChildren();
 if(!events.length){const empty=document.createElement('div');empty.className='timelineEmpty';empty.textContent='조건에 맞는 모션 기록이 없습니다.';timeline.appendChild(empty);return}
 for(const entry of events){
  const button=document.createElement('button');button.type='button';button.className='timelineEvent';
  button.dataset.mode=entry.mode;button.dataset.life=String(entry.lifeId);
  button.textContent=entry.time.toFixed(2)+'초 · SPR '+entry.spriteId+' · '+names[entry.mode]+' · 방향 '+entry.dir+' · HP '+entry.hp+' · 키 '+entry.sprKey;
  button.setAttribute('aria-label','필드 기록 '+names[entry.mode]+' 방향 '+entry.dir+' 검수');
  button.onclick=()=>inspectField(entry);
  timeline.appendChild(button);
 }
}
el('timelineToggle').onclick=()=>{timelineBody.hidden=!timelineBody.hidden;el('timelineToggle').textContent=timelineBody.hidden?'이력 열기':'이력 접기';if(!timelineBody.hidden)refreshTimeline()};
el('timelineAll').onclick=()=>{historyAll=!historyAll;refreshTimeline()};
el('timelineMode').onchange=refreshTimeline;
spriteFilter.onchange=refreshTimeline;
el('timelineRefresh').onclick=refreshTimeline;
el('timelineClear').onclick=()=>{if(confirm('현재 플레이 중 수집한 모션 이력을 지울까요?')){historySource()?.clear();refreshTimeline()}};
el('timelineExport').onclick=()=>saveFile('sanctuary-v19-field-motion-history.json',{schema:'sanctuary.field-motion-history.v1',version:19,view:{scope:historyAll?'all':'focus',mode:el('timelineMode').value,sprite:spriteFilter.value},focus:historySource()?.focus(),events:historySource()?.events('all',160)||[]});
el('fieldHistory').onclick=()=>{if(el('lab').hidden)el('labOpen').click();if(timelineBody.hidden)el('timelineToggle').click();else refreshTimeline();el('timelinePanel').scrollIntoView?.({block:'start'})};
el('labOpen').addEventListener('click',refreshTimeline);

selector.onchange=()=>changeActor(selector.value,true);
el('labActor').addEventListener('change',()=>changeActor(el('labActor').value,false));
el('reviewPrev').onclick=()=>{let i=(actions.indexOf(selectedMode)*8+selectedDir+39)%40;select(actions[Math.floor(i/8)],i%8)};
el('reviewNext').onclick=()=>{let i=(actions.indexOf(selectedMode)*8+selectedDir+1)%40;select(actions[Math.floor(i/8)],i%8)};
el('reviewOk').onclick=()=>{if(available()){decisions[current][position()]='ok';persist()}};
el('reviewQuestion').onclick=()=>{if(available()){decisions[current][position()]='question';persist()}};
el('reviewUnset').onclick=()=>{delete decisions[current][position()];persist()};
el('reviewClear').onclick=()=>{if(confirm('선택한 SPR의 검토 표시를 초기화할까요?')){decisions[current]={};persist()}};
el('reviewExport').onclick=()=>saveFile('sanctuary-v16-motion-reviews.json',reviewSnapshot());
el('reviewTrialExport').onclick=()=>saveFile('sanctuary-v16-motion-trials.json',snapshot());
el('reviewImport').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;
 try{if(!takeImported(JSON.parse(await file.text())))throw Error('몬스터 SPR 또는 추출 출처가 일치하지 않습니다');persist()}catch(err){alert('검수 파일 오류: '+err.message)}event.target.value=''};
for(const [mode,id] of [['legacy','reviewTrialLegacy'],['approved','reviewTrialApproved'],['all','reviewTrialAll']])el(id).onclick=()=>setMode(mode,current);
document.addEventListener('visibilitychange',wake);
el('labOpen').addEventListener('click',wake);
window.SANCTUARY_MOTION_TRIAL={mode:id=>modes[id]||'legacy',active,setMode,status:(mode,dir,id=current)=>status(id,mode,dir),approvedCount,hasPack:id=>Boolean(candidates[id]),actors:()=>actorKeys.slice(),frameState:()=>({paused:framePaused,step:frameStep,actor:current,mode:selectedMode,dir:selectedDir}),reviewed:()=>reviewSnapshot(),import:takeImported,select:changeActor,inspectField};
changeActor(current,false);
window.SANCTUARY_REVIEW_READY=true;
})();
