(()=>{'use strict';
const D=window.SANCTUARY_MANIFEST;if(!D)throw Error('Missing game data');
const M=D.map, W=M.size[0], H=M.size[1], OX=M.origin[0], OY=M.origin[1];
const el=id=>document.getElementById(id);
const scene=el('field'),ctx=scene.getContext('2d',{alpha:false});
const preview=el('labPreview'),pctx=preview.getContext('2d',{alpha:false});
const mapCanvas=el('minimap'),mctx=mapCanvas.getContext('2d');
const TW=64, TH=32, KEYS=['idle','walk','attack','hit','death'],imgCache=new Map();
const assetStats={requested:0,loaded:0},assetFailed=new Set();let lastAssetUpdate=0,lastMiniPaint=0;
let perfGround=0,perfGroundVisible=0,perfObjCells=0,perfFrames=0,perfSince=0,lastHudStamp=-1,prefetchBudget=0;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
const KEYSTORE='sanctuary-spr-motion-map-v3';
const V4KEY='sanctuary-v4-map-overlay';
let sw=0,sh=0,dpr=1,clock=0,last=0,open=false,auto=true;
const ROSTER=['enemy','mob56','mob1022','mob54','mob998','mob1002','mob55'];
const MOTION_PACK=window.SANCTUARY_MONSTER_PACK;
const packActors={};const MOTION_PACK_KEY='sanctuary-v12-monster-pack-on';
const observedMotions=[],motionLast=new Map(),MOTION_LOG_CAP=240;
let motionPackEnabled=false;
try{motionPackEnabled=localStorage.getItem(MOTION_PACK_KEY)==='true'}catch(e){}
if(MOTION_PACK?.schema==='sanctuary.monster-motion.v1'){
 for(const [name,entry] of Object.entries(MOTION_PACK.actors||{})){
  if(!/^[a-z][a-z0-9_-]{1,31}$/.test(name)||!Number.isInteger(entry?.sprite_id))continue;
  if(D.actors[name]&&D.actors[name].sprite_id!==entry.sprite_id)continue;
  const actions={};let count=0;
  for(const [mode,group] of Object.entries(entry.actions||{})){
   if(!['idle','walk','attack','hit','death'].includes(mode))continue;
   for(const row of group?.directions||[]){
    if(!Number.isInteger(row?.key)||!Array.isArray(row.frames)||!row.frames.length)continue;
    if(!row.frames.every(f=>typeof f==='string'&&f.startsWith('assets/')&&!f.includes('..')&&/^[a-zA-Z0-9_./-]+\.png$/.test(f)))continue;
    actions[String(row.key)]=row.frames;count++;
   }
  }
  if(!count)continue;
  if(!D.actors[name]){
   D.actors[name]={sprite_id:entry.sprite_id,actions,converted:count,total_indexed:count,keys_are_verified_actions:false};
   if(entry.roster===true)ROSTER.push(name);
  }
  packActors[name]=entry;
 }
}
let heroVisualTrial='hero';
let score=0,potions=10,hero,mobs=[],mapped=Object.fromEntries(Object.keys(D.actors).map(k=>[k,{}]));
let stickId=null,stickVector={x:0,y:0},pressed={};
let labPage=0,selectedKey=0,toastUntil=0,showBlocked=false,showObjects=true,showTextures=true;
let selectedMob=null,queuedAttack=false,damageNumbers=[];
// V18: visual-only history; never participates in hit or AI calculations.
const fieldHistory=[],historySignatures=new Map(),FIELD_HISTORY_CAP=160;
let fieldSpawnSeq=0,historyFocus=null;
const UI_SETTINGS_KEY='sanctuary-mobile-v8';
let cameraZoom=1,paintFPS=30,lastPaint=0,settingsOpen=false,controlSize='normal';
let frameFingers=new Map(),tapFinger=null,pinching=false,pinchStartDistance=0,pinchStartZoom=1;

          const atlases=new Map(),objectCells=Array.from({length:W*H},()=>null);
          for(const ob of M.objects){let ix=ob[0]>>1,iy=ob[1];if(ix>=0&&ix<W&&iy>=0&&iy<H){let key=iy*W+ix;(objectCells[key]??=[]).push(ob)}}
try{let obj=JSON.parse(localStorage.getItem(KEYSTORE)||'null');if(obj)importMapping(obj,false)}catch(e){}
try{showBlocked=localStorage.getItem(V4KEY)==='true'}catch(e){}
function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}
function rnd(lo,hi){return lo+Math.random()*(hi-lo)}
function cellIndex(x,y){let a=Math.floor(x)-OX,b=Math.floor(y)-OY;return a>=0&&b>=0&&a<W&&b<H?b*W+a:-1}
function flag(x,y){let i=cellIndex(x,y);return i<0?255:M.flags[i]}
function passCell(x,y){let i=cellIndex(x,y);return i>=0&&(M.flags[i]&1)===0}
function safe(x,y){return (flag(x,y)&4)!==0}
function passFoot(x,y){return passCell(x-.2,y-.2)&&passCell(x+.2,y-.2)&&passCell(x-.2,y+.2)&&passCell(x+.2,y+.2)}
function moveFoot(a,x,y){let nx=a.x+x,ny=a.y+y;if(passFoot(nx,ny)){a.x=nx;a.y=ny;return true}let ok=false;if(passFoot(nx,a.y)){a.x=nx;ok=true}if(passFoot(a.x,ny)){a.y=ny;ok=true}return ok}
function findOpen(x,y,radius=7){let bx=Math.floor(x),by=Math.floor(y);for(let d=0;d<=radius;d++){for(let ay=-d;ay<=d;ay++)for(let ax=-d;ax<=d;ax++){if(Math.max(Math.abs(ax),Math.abs(ay))!==d)continue;let tx=bx+ax,ty=by+ay;if(passCell(tx,ty))return {x:tx+.5,y:ty+.5}}}return null}
function findPath(from,to,maxNodes=W*H){let start=cellIndex(from.x,from.y),goal=cellIndex(to.x,to.y);if(start<0||goal<0||!passCell(to.x,to.y))return [];
if(start===goal)return [{x:Math.floor(to.x)+.5,y:Math.floor(to.y)+.5}];
let prev=new Int32Array(W*H);prev.fill(-1);let queue=new Int32Array(W*H),head=0,tail=1;queue[0]=start;prev[start]=start;
while(head<tail&&head<maxNodes){let at=queue[head++],x=at%W,y=Math.floor(at/W);
for(let [dx,dy] of DIRS){let nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;let ni=ny*W+nx;if(prev[ni]>=0||(M.flags[ni]&1))continue;if(dx&&dy){if((M.flags[y*W+nx]&1)||(M.flags[ny*W+x]&1))continue}
prev[ni]=at;queue[tail++]=ni;if(ni===goal){head=tail;break}}
}
if(prev[goal]<0)return [];
let path=[],id=goal;while(id!==start&&path.length<W*H){path.push({x:OX+(id%W)+.5,y:OY+Math.floor(id/W)+.5});id=prev[id];if(id<0)return []}path.reverse();return path}
function loadImage(url){const im=new Image();im.decoding='async';assetStats.requested++;im.onload=()=>{assetStats.loaded++;assetFailed.delete(url)};im.onerror=()=>{assetFailed.add(url)};im.src=url;return im}
function img(url){if(imgCache.has(url)){let im=imgCache.get(url);imgCache.delete(url);imgCache.set(url,im);return im}let im=loadImage(url);imgCache.set(url,im);if(imgCache.size>420)imgCache.delete(imgCache.keys().next().value);return im}
function refreshAssetStatus(){const status=el('assetStatus');status.textContent='원본 이미지 로딩 '+assetStats.loaded+' / '+assetStats.requested+' · 실패 '+assetFailed.size+' · 캐시 '+imgCache.size;status.style.color=assetFailed.size?'#ffb1aa':'#bce8c7'}
function retryFailedImages(){let count=assetFailed.size;for(const url of assetFailed){imgCache.delete(url);if(url.startsWith('tiles/')&&url.endsWith('.png'))atlases.delete(Number(url.slice(6,-4)))}assetFailed.clear();refreshAssetStatus();if(count)msg('실패 이미지 '+count+'개 재시도 준비',1.2);else msg('실패한 이미지가 없습니다',.8)}
const GROUP_BASE={walk:0,attack:8,hit:16,death:24,idle:32};
function candidateFor(actor,mode,dir){
 const policy=window.SANCTUARY_MOTION_TRIAL;
 return policy?.active?policy.active(actor,mode,dir):motionPackEnabled;
}
function paths(actor,mode,dir){
 const actions=D.actors[actor]?.actions;if(!actions)return [];
 const manual=mapped[actor]?.[mode]?.[dir];
 if(manual!==undefined&&actions[String(manual)])return actions[String(manual)];
 const packRow=candidateFor(actor,mode,dir)?packActors[actor]?.actions?.[mode]?.directions?.[dir]:null;
 if(packRow?.frames?.length)return packRow.frames;
 const first=GROUP_BASE[mode]??0;
 const choices=[first+dir,mode==='idle'?24+dir:32+dir,mode==='death'?16+dir:0+dir,dir];
 for(const key of choices){let seq=actions[String(key)];if(seq?.length)return seq}
 return [];
}
function describeMotion(actor,mode,dir){
 const actions=D.actors[actor]?.actions||{};
 const manual=mapped[actor]?.[mode]?.[dir];
 if(manual!==undefined&&actions[String(manual)])return {source:'수동 배정',key:String(manual),frames:actions[String(manual)].length};
 const group=packActors[actor]?.actions?.[mode];
 const row=candidateFor(actor,mode,dir)?group?.directions?.[dir]:null;
 if(row?.frames?.length)return {source:'원본 추출 후보',key:String(row.key),frames:row.frames.length,delayMs:group.delayMs};
 const base=GROUP_BASE[mode]??0;
 const keys=[base+dir,mode==='idle'?24+dir:32+dir,mode==='death'?16+dir:dir,dir];
 for(const key of keys)if(actions[String(key)]?.length)return {source:'기존 기본 추정',key:String(key),frames:actions[String(key)].length};
 return {source:'미배정',key:'-',frames:0};
}
function visualFPS(actor,mode,dir){
 if(mode!=='idle'&&mode!=='walk')return 9;
 if(mapped[actor]?.[mode]?.[dir]!==undefined)return 9;
 const group=candidateFor(actor,mode,dir)?packActors[actor]?.actions?.[mode]:null;
 const delay=group?.directions?.[dir]?.frames?.length?Number(group.delayMs):0;
 return delay>0?1000/clamp(delay,60,500):9;
}
function observeMotion(m){
 if(!m||!packActors[m.visual])return;
 const signature=[m.visual,m.mode,m.dir,candidateFor(m.visual,m.mode,m.dir),window.SANCTUARY_MOTION_TRIAL?.mode(m.visual)||'legacy'].join('|');
 if(motionLast.get(m.id)===signature)return;
 motionLast.set(m.id,signature);
 const motion=describeMotion(m.visual,m.mode,m.dir);
 observedMotions.push({time:Number(clock.toFixed(2)),mobId:m.id,spriteId:D.actors[m.visual].sprite_id,mode:m.mode,direction:m.dir,source:motion.source,sprKey:motion.key,frameCount:motion.frames,candidateEnabled:candidateFor(m.visual,m.mode,m.dir),trialMode:window.SANCTUARY_MOTION_TRIAL?.mode(m.visual)||'legacy',hp:Math.ceil(m.hp)});
 if(observedMotions.length>MOTION_LOG_CAP)observedMotions.shift();
}
function recordFieldMotion(m){
 if(!m||!Number.isInteger(m.spawnSerial))return;
 const key=m.mode+'|'+m.dir;
 if(historySignatures.get(m.spawnSerial)===key)return;
 historySignatures.set(m.spawnSerial,key);
 const desc=describeMotion(m.visual,m.mode,m.dir);
 fieldHistory.push({time:Number(clock.toFixed(2)),lifeId:m.spawnSerial,mobId:m.id,actor:m.visual,
  spriteId:D.actors[m.visual].sprite_id,mode:m.mode,dir:m.dir,hp:Math.ceil(m.hp),
  sprKey:desc.key,frameCount:desc.frames,source:desc.source,
  trialMode:window.SANCTUARY_MOTION_TRIAL?.mode(m.visual)||'legacy'});
 if(fieldHistory.length>FIELD_HISTORY_CAP)fieldHistory.shift();
}
window.SANCTUARY_FIELD_HISTORY={
 events:(scope='focus',limit=40)=>{
  const selected=scope==='all'||!historyFocus?fieldHistory:fieldHistory.filter(e=>e.lifeId===historyFocus.lifeId);
  return selected.slice(-Math.max(1,Math.min(160,Math.floor(Number(limit)||40)))).reverse().map(e=>({...e}));
 },
 focus:()=>historyFocus?{...historyFocus}:null,
 clear:()=>{fieldHistory.length=0;historySignatures.clear()},
 length:()=>fieldHistory.length
};
function updateFieldMotion(){
 const info=el('fieldMotionInfo'),toggle=el('fieldPackToggle'),m=selectedMob;
 if(!m||m.dead){info.textContent='';toggle.hidden=true;return}
 const data=describeMotion(m.visual,m.mode,m.dir);
 info.textContent=m.mode+' · 방향 '+m.dir+' · 원본 키 '+data.key+' ('+data.frames+'프레임)\n'+data.source;
 toggle.hidden=!packActors[m.visual];
 if(!toggle.hidden){const trial=window.SANCTUARY_MOTION_TRIAL?.mode(m.visual)||'legacy';toggle.textContent=trial==='all'?'모든 후보 OFF · 기존 동작':trial==='approved'?'정상 표시만 ON · 전체 후보로':'전체 후보 ON · 비교';}
}
function exportMotionLog(){
 const payload={schema:'sanctuary.motion-observations.v1',engine:'V13',sourceRun:39041076096,originalSpriteProvenance:'Extracted original PNG; actions and directions unverified',candidateEnabled:motionPackEnabled,trialModes:Object.fromEntries(Object.keys(packActors).map(a=>[a,window.SANCTUARY_MOTION_TRIAL?.mode(a)||'legacy'])),events:observedMotions.slice()};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='sanctuary-v13-motion-observations.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function resize(){
  dpr=Math.min(1.5,window.devicePixelRatio||devicePixelRatio||1);
  sw=Math.max(1,scene.clientWidth);sh=Math.max(1,scene.clientHeight);
  scene.width=Math.max(1,Math.round(sw*dpr));scene.height=Math.max(1,Math.round(sh*dpr));
  last=0;lastPaint=0;
}
window.addEventListener('resize',()=>{stopMovement();resize()});
window.addEventListener('orientationchange',()=>{stopMovement();setTimeout(resize,120)});
if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>{stopMovement();resize()});
resize();
function msg(text,delay=1.8){el('tip').textContent=text;el('tip').style.opacity='1';toastUntil=performance.now()+delay*1000}
function refresh(){el('lifebar').style.width=clamp(hero.hp,0,100)+'%';el('hpText').textContent='HP '+Math.ceil(hero.hp)+'/100';el('counts').textContent='처치 '+score;el('potion').textContent='물약 '+potions;
let area=safe(hero.x,hero.y)?'안전':'일반';el('gameState').textContent='Map 4 · '+Math.floor(hero.x)+','+Math.floor(hero.y)+' · '+area;el('mapText').textContent='Map 4 | TIL '+M.tile_decode.decoded_variants+'종 · SPR '+ROSTER.length+'종';el('overlayToggle').textContent=showBlocked?'충돌 ON':'충돌 OFF'}
function begin(){clock=0;fieldHistory.length=0;historySignatures.clear();historyFocus=null;fieldSpawnSeq=0;motionLast.clear();lastHudStamp=-1;score=0;potions=10;let initial=findOpen(M.spawn[0],M.spawn[1],10);if(!initial)throw Error('Spawn location unavailable');
hero={x:initial.x,y:initial.y,hp:100,anim:0,dir:0,mode:'idle',dead:false,attackCd:0,attackUntil:0,hurtUntil:0,damageAt:0,damageDone:true,hitTarget:null,path:[],goalMob:null};
selectedMob=null;queuedAttack=false;damageNumbers=[];mobs=Array.from({length:ROSTER.length},(_,i)=>makeMob(i));refresh();targetHUD();msg('원본 SPR 7종 · 몬스터를 터치해 선택',3)}
function makeMob(id){let candidate=null;for(let t=0;t<90;t++){let a=rnd(-Math.PI,Math.PI),r=rnd(4,11),x=hero.x+Math.cos(a)*r,y=hero.y+Math.sin(a)*r;if(!passFoot(x,y)||safe(x,y))continue;candidate={x,y};break}if(!candidate)candidate=findOpen(hero.x+4,hero.y+3,15)||{x:hero.x,y:hero.y};return {id,spawnSerial:++fieldSpawnSeq,x:candidate.x,y:candidate.y,visual:ROSTER[id%ROSTER.length],hp:35,maxHp:35,pendingHit:false,impactAt:0,anim:0,dir:id%8,mode:'idle',dead:false,deadAt:0,attackCd:rnd(.3,1.5),attackUntil:0,hurtUntil:0,path:[],repath:0}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function nearest(radius){let best=null,bd=radius;for(let m of mobs)if(!m.dead){let d=dist(hero,m);if(d<bd){best=m;bd=d}}return best}
window.SANCTUARY_GET_FIELD_TARGET=()=>{const m=selectedMob;if(!m||m.dead)return null;return {actor:m.visual,mode:m.mode,dir:m.dir,mobId:m.id,spriteId:D.actors[m.visual].sprite_id,hp:Math.ceil(m.hp)}};
function targetHUD(){const panel=el('targetPanel');if(!selectedMob||selectedMob.dead){window.SANCTUARY_FIELD_TARGET=null;panel.hidden=true;updateFieldMotion();return}window.SANCTUARY_FIELD_TARGET={actor:selectedMob.visual,mode:selectedMob.mode,dir:selectedMob.dir,mobId:selectedMob.id,spriteId:D.actors[selectedMob.visual].sprite_id,hp:Math.ceil(selectedMob.hp)};panel.hidden=false;el('targetLabel').textContent='원본 SPR '+D.actors[selectedMob.visual].sprite_id;el('targetHP').textContent='HP '+Math.max(0,Math.ceil(selectedMob.hp))+' / '+selectedMob.maxHp;el('targetFill').style.width=clamp(selectedMob.hp/selectedMob.maxHp*100,0,100)+'%';updateFieldMotion()}
function targetChoose(mob,follow=true){if(!mob||mob.dead)return;selectedMob=mob;historyFocus={lifeId:mob.spawnSerial,actor:mob.visual,mobId:mob.id,spriteId:D.actors[mob.visual].sprite_id};queuedAttack=false;if(follow){hero.goalMob=mob;hero.goalMobRepath=0;hero.path=[]}targetHUD()}
function targetForget(){selectedMob=null;queuedAttack=false;hero.goalMob=null;hero.path=[];targetHUD()}
function targetInRange(radius){if(selectedMob&&!selectedMob.dead)return dist(hero,selectedMob)<=radius?selectedMob:null;return nearest(radius)}
function damageText(unit,value,color){damageNumbers.push({x:unit.x,y:unit.y,value:String(value),color,until:clock+.85});if(damageNumbers.length>50)damageNumbers.shift()}
function drawTargetRing(){if(!selectedMob||selectedMob.dead)return;let p=screen(selectedMob.x,selectedMob.y);ctx.save();ctx.strokeStyle='#ffe079';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y+19,25,10,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
function drawDamageText(){ctx.save();ctx.textAlign='center';ctx.font='bold 18px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#241a17';for(const fx of damageNumbers){let left=fx.until-clock;if(left<=0)continue;let p=screen(fx.x,fx.y),py=p.y-53-(.85-left)*34;ctx.globalAlpha=clamp(left*2,0,1);ctx.strokeText(fx.value,p.x,py);ctx.fillStyle=fx.color;ctx.fillText(fx.value,p.x,py)}ctx.restore()}
function setMode(a,newMode){if(a.mode!==newMode){a.mode=newMode;a.anim=0}}
function facing(dx,dy){return(Math.round((Math.atan2(dy,dx)+Math.PI)*4/Math.PI)+8)%8}
function tryAttack(manual=false){if(open||hero.dead||hero.attackCd>0)return false;if(safe(hero.x,hero.y)){if(manual)msg('안전지대에서는 공격할 수 없습니다',.7);return false}const target=targetInRange(1.7);if(!target&&selectedMob&&!selectedMob.dead){if(manual)queuedAttack=true;hero.goalMob=selectedMob;hero.goalMobRepath=0;hero.path=[];if(manual)msg('선택 대상에게 접근',.8);return false}if(!target&&!manual)return false;hero.attackCd=.54;hero.attackUntil=clock+.42;hero.damageAt=clock+.21;hero.damageDone=false;hero.hitTarget=target;queuedAttack=false;if(target){let dx=target.x-hero.x,dy=target.y-hero.y;hero.dir=facing((dx-dy)*TW/2,(dx+dy)*TH/2)}setMode(hero,'attack');return true}
function applyHit(){hero.damageDone=true;const mob=hero.hitTarget;hero.hitTarget=null;if(!mob||mob.dead||dist(hero,mob)>1.85)return;mob.hp=Math.max(0,mob.hp-12);mob.hurtUntil=clock+.25;damageText(mob,'-12','#ffe5b3');if(mob.hp===0){mob.dead=true;mob.deadAt=clock;score++;setMode(mob,'death');recordFieldMotion(mob);if(mob===selectedMob)targetForget()}else setMode(mob,'hit');targetHUD();refresh()}
function drink(){if(hero.dead){msg('다시 시작하세요');return}if(!potions){msg('물약이 없습니다');return}if(hero.hp>=100){msg('HP가 가득합니다');return}potions--;const amount=Math.min(40,100-hero.hp);hero.hp+=amount;damageText(hero,'+'+amount,'#9affc1');refresh()}
function travel(actor,route,dt,speed){
  if(!route.length)return false;
  let remaining=Math.max(0,dt*speed),moved=false,steps=0;
  while(remaining>0.0001&&route.length&&steps++<8){
    const target=route[0],dx=target.x-actor.x,dy=target.y-actor.y,distStep=Math.hypot(dx,dy);
    if(distStep<.12){route.shift();continue}
    const length=Math.min(distStep,remaining);
    if(!moveFoot(actor,dx/distStep*length,dy/distStep*length)){route.length=0;return moved}
    actor.dir=facing((dx-dy)*TW/2,(dx+dy)*TH/2);
    moved=true;remaining-=length;
    if(distStep-length<.12)route.shift();
  }
  return moved;
}
function setDestination(x,y){let destination=findOpen(x,y,5);if(!destination){msg('갈 수 없는 위치입니다');return false}let route=findPath(hero,destination);if(!route.length){msg('연결된 이동 경로가 없습니다');return false}targetForget();hero.path=route;msg('원본 S32 이동 경로 '+route.length+'칸',.8);return true}
function update(dt){if(open||settingsOpen||document.hidden)return;clock+=dt;damageNumbers=damageNumbers.filter(x=>x.until>clock);hero.anim+=dt;if(hero.dead)return;hero.attackCd=Math.max(0,hero.attackCd-dt);if(!hero.damageDone&&clock>=hero.damageAt)applyHit();if(selectedMob&&selectedMob.dead)targetForget();
let dx=stickVector.x,dy=stickVector.y;if(pressed.ArrowLeft||pressed.a)dx--;if(pressed.ArrowRight||pressed.d)dx++;if(pressed.ArrowUp||pressed.w)dy--;if(pressed.ArrowDown||pressed.s)dy++;
let moving=false,n=Math.hypot(dx,dy);if(n>.06){hero.path=[];hero.goalMob=null;queuedAttack=false;dx/=n;dy/=n;let wx=dx/2+dy,wy=dy-dx/2,wl=Math.hypot(wx,wy);moving=moveFoot(hero,wx/wl*dt*2.8,wy/wl*dt*2.8);if(moving)hero.dir=facing(dx,dy)}
else if(hero.goalMob&&!hero.goalMob.dead){if(dist(hero,hero.goalMob)>1.3){if(clock>=hero.goalMobRepath){hero.path=findPath(hero,hero.goalMob,8000);hero.goalMobRepath=clock+.55}moving=travel(hero,hero.path,dt,2.8)}else{hero.path=[];if((auto||queuedAttack)&&hero.attackCd<=0)tryAttack(false)}}
else moving=travel(hero,hero.path,dt,2.8);
if(clock<hero.attackUntil)setMode(hero,'attack');else if(clock<hero.hurtUntil)setMode(hero,'hit');else setMode(hero,moving?'walk':'idle');
for(const mob of mobs){if(mob.dead){if(clock-mob.deadAt>3){historySignatures.delete(mob.spawnSerial);mobs[mob.id]=makeMob(mob.id)};continue}mob.anim+=dt;mob.attackCd=Math.max(0,mob.attackCd-dt);if(mob.pendingHit&&clock>=mob.impactAt){mob.pendingHit=false;if(!safe(hero.x,hero.y)&&dist(mob,hero)<=1.4&&!hero.dead){hero.hp=Math.max(0,hero.hp-7);hero.hurtUntil=clock+.25;damageText(hero,'-7','#ffaaaa');if(hero.hp===0){hero.dead=true;hero.deadAt=clock;hero.path=[];queuedAttack=false;setMode(hero,'death');msg('전투 불능 · 다시 시작 버튼',5)}}}
let distance=dist(mob,hero),mobMoved=false;if(distance<7&&!safe(hero.x,hero.y)&&!safe(mob.x,mob.y)&&!hero.dead){if(distance>1.1){if(clock>=mob.repath){mob.path=findPath(mob,hero,8000);mob.repath=clock+.95}mobMoved=travel(mob,mob.path,dt,.7)}else if(mob.attackCd<=0){mob.attackCd=1.35;mob.attackUntil=clock+.38;mob.impactAt=clock+.19;mob.pendingHit=true;const mx=hero.x-mob.x,my=hero.y-mob.y;mob.dir=facing((mx-my)*TW/2,(mx+my)*TH/2)}}
if(clock<mob.attackUntil)setMode(mob,'attack');else if(clock<mob.hurtUntil)setMode(mob,'hit');else setMode(mob,mobMoved?'walk':'idle')}
for(const mob of mobs){recordFieldMotion(mob);observeMotion(mob)}if(auto&&!hero.goalMob&&hero.attackCd<=0&&targetInRange(1.7))tryAttack(false);if(lastHudStamp<0||clock-lastHudStamp>=.14){lastHudStamp=clock;targetHUD();refresh()}}
function iso(x,y){return{x:(x-y)*TW/2,y:(x+y)*TH/2}}
function screen(x,y){let d=iso(x,y),h=iso(hero.x,hero.y);return{x:sw*.5+d.x-h.x,y:sh*.46+d.y-h.y}}
function viewRadius(){return clamp(Math.ceil((sw/32+sh/16)/(4*cameraZoom))+7,14,54)}
function outsideView(px,py,buffer=40){
  const x=sw/2+(px-sw/2)*cameraZoom,y=sh/2+(py-sh/2)*cameraZoom;
  return x< -buffer||x>sw+buffer||y< -buffer||y>sh+buffer;
}
function rowClip(worldY,minX,maxX,padding){
  const zoom=cameraZoom,dx=hero.x-hero.y,dy=hero.x+hero.y;
  const ux0=(-padding-sw/2)/(zoom*32),ux1=(sw+padding-sw/2)/(zoom*32);
  const vyOffset=sh/2-sh*.46;
  const vy0=((-padding-sh/2)/zoom+vyOffset)/16;
  const vy1=((sh+padding-sh/2)/zoom+vyOffset)/16;
  const lo=Math.ceil(Math.max(minX,ux0+dx+worldY,vy0+dy-worldY-1)-1e-6);
  const hi=Math.floor(Math.min(maxX,ux1+dx+worldY,vy1+dy-worldY-1)+1e-6);
  return [lo,hi];
}
function tileAtlas(id){let im=atlases.get(id);if(im){atlases.delete(id);atlases.set(id,im);return im}im=loadImage('tiles/'+id+'.png');atlases.set(id,im);if(atlases.size>128)atlases.delete(atlases.keys().next().value);return im}
function tileHalf(packed,dx,dy){if(packed<0)return false;let id=Math.floor(packed/256),key=packed%256,atlas=tileAtlas(id);if(showTextures&&atlas.complete&&atlas.naturalWidth){ctx.drawImage(atlas,key%16*24,Math.floor(key/16)*24,24,24,dx,dy,32,32);return true}return false}
function drawObject(ob){let half=ob[0]%2,wx=OX+Math.floor(ob[0]/2)+.5,wy=OY+ob[1]+.5,p=screen(wx,wy);tileHalf(ob[2],p.x-32+half*32,p.y-16)}
function getVisibleObjects(){
  if(!showObjects||!showTextures){perfObjCells=0;return []}
  const range=viewRadius(),cx=Math.floor(hero.x-OX),cy=Math.floor(hero.y-OY),out=[];
  perfObjCells=0;
  for(let iy=Math.max(0,cy-range);iy<=Math.min(H-1,cy+range);iy++){
    const worldY=OY+iy;
    const bounds=rowClip(worldY,OX+Math.max(0,cx-range),OX+Math.min(W-1,cx+range),88);
    let left=Math.max(0,bounds[0]-OX),right=Math.min(W-1,bounds[1]-OX);
    if(left>right)continue;
    let px=sw*.5+((OX+left-worldY)-(hero.x-hero.y))*TW/2;
    let py=sh*.46+((OX+left+worldY+1)-(hero.x+hero.y))*TH/2;
    for(let ix=left;ix<=right;ix++,px+=TW/2,py+=TH/2){
      perfObjCells++;
      const list=objectCells[iy*W+ix];
      if(!list||outsideView(px,py,80))continue;
      const wx=OX+ix+.5,wy=worldY+.5;
      for(const ob of list)out.push({ob,depth:wx+wy+ob[3]/2048});
    }
  }
  return out;
}
function ground(){
  ctx.fillStyle='#192a26';ctx.fillRect(0,0,sw,sh);
  const range=viewRadius(),fx=Math.floor(hero.x),fy=Math.floor(hero.y);
  perfGround=0;perfGroundVisible=0;
  for(let y=Math.max(OY,fy-range);y<=Math.min(OY+H-1,fy+range);y++){
    const [lo,hi]=rowClip(y,Math.max(OX,fx-range),Math.min(OX+W-1,fx+range),48);
    if(lo>hi)continue;
    let idx=(y-OY)*W+(lo-OX);
    let px=sw*.5+((lo-y)-(hero.x-hero.y))*TW/2;
    let py=sh*.46+((lo+y+1)-(hero.x+hero.y))*TH/2;
    for(let x=lo;x<=hi;x++,idx++,px+=TW/2,py+=TH/2){
      perfGround++;
      if(outsideView(px,py,40))continue;
      perfGroundVisible++;
      const a=M.floorA[idx],b=M.floorB[idx],c1=M.tileColors[a]||'#345247',c2=M.tileColors[b]||c1;
      if(!tileHalf(a,px-32,py-16)){
        ctx.fillStyle=c1;ctx.beginPath();ctx.moveTo(px,py-16);ctx.lineTo(px-32,py);ctx.lineTo(px,py+16);ctx.fill();
      }
      if(!tileHalf(b,px,py-16)){
        ctx.fillStyle=c2;ctx.beginPath();ctx.moveTo(px,py-16);ctx.lineTo(px+32,py);ctx.lineTo(px,py+16);ctx.fill();
      }
      if(M.overlayA[idx]>=0)tileHalf(M.overlayA[idx],px-32,py-16);
      if(M.overlayB[idx]>=0)tileHalf(M.overlayB[idx],px,py-16);
      if(showBlocked){
        let bits=M.flags[idx];if(bits&1)ctx.fillStyle='#e24f4b8c';else if(bits&4)ctx.fillStyle='#5ba9e33c';else continue;
        ctx.beginPath();ctx.moveTo(px,py-16);ctx.lineTo(px+32,py);ctx.lineTo(px,py+16);ctx.lineTo(px-32,py);ctx.closePath();ctx.fill();
      }
    }
  }
}
function drawActor(unit,type){if(unit.dead&&clock-unit.deadAt>1.5)return;const displayType=type==='hero'?heroVisualTrial:type;let p=screen(unit.x,unit.y),foot=p.y+17,seq=paths(displayType,unit.mode,unit.dir),duration=unit.mode==='attack'?.42:unit.mode==='hit'?.26:unit.mode==='death'?1.25:0,elapsed=unit.dead?Math.max(0,clock-unit.deadAt):unit.anim,fi=seq.length?(duration?Math.min(seq.length-1,Math.floor(elapsed/duration*seq.length)):Math.floor(elapsed*visualFPS(displayType,unit.mode,unit.dir))%seq.length):0,frame=seq.length?seq[fi]:null,im=frame?img(frame):null;
ctx.fillStyle='#050e0b80';ctx.beginPath();ctx.ellipse(p.x,foot+3,21,7,0,0,Math.PI*2);ctx.fill();
if(im&&im.complete&&im.naturalWidth){let scale=1.04,w=im.naturalWidth*scale,h=im.naturalHeight*scale;ctx.save();if(unit.mode==='hit')ctx.globalAlpha=.65+.35*Math.abs(Math.sin(clock*36));ctx.drawImage(im,p.x-w/2,foot-h,w,h);ctx.restore()}
else {ctx.fillStyle=type==='hero'?'#e2c992':'#c98478';ctx.fillRect(p.x-13,foot-32,26,32)}
if(seq.length>1&&(type==='hero'||prefetchBudget>0)){const next=seq[(fi+1)%seq.length];if(next&&!imgCache.has(next)){img(next);if(type!=='hero')prefetchBudget--}}
if(type!=='hero'&&unit.hp<35&&!unit.dead){ctx.fillStyle='#4f2927';ctx.fillRect(p.x-19,foot-79,38,5);ctx.fillStyle='#da5f50';ctx.fillRect(p.x-19,foot-79,38*unit.hp/35,5)}}
let miniBase=document.createElement('canvas');miniBase.width=W;miniBase.height=H;let miniBG=miniBase.getContext('2d');let pix=miniBG.createImageData(W,H);
for(let i=0;i<W*H;i++){let a=M.flags[i],k=i*4;if(a&1){pix.data[k]=27;pix.data[k+1]=40;pix.data[k+2]=38}else if(a&4){pix.data[k]=69;pix.data[k+1]=126;pix.data[k+2]=156}else{let key=M.tileColors[M.floorA[i]]||'#395b49';pix.data[k]=parseInt(key.slice(1,3),16);pix.data[k+1]=parseInt(key.slice(3,5),16);pix.data[k+2]=parseInt(key.slice(5,7),16)}pix.data[k+3]=255}
miniBG.putImageData(pix,0,0);let mapShown=true;
function drawMini(t){if(!mapShown||(lastMiniPaint&&t-lastMiniPaint<180))return;lastMiniPaint=t;mctx.imageSmoothingEnabled=false;mctx.clearRect(0,0,192,192);mctx.drawImage(miniBase,0,0,192,192);for(let m of mobs)if(!m.dead){mctx.fillStyle='#e4986e';mctx.fillRect(m.x-OX-2,m.y-OY-2,4,4)}if(selectedMob&&!selectedMob.dead){mctx.strokeStyle='#ffdf70';mctx.lineWidth=2;mctx.strokeRect(selectedMob.x-OX-4,selectedMob.y-OY-4,8,8)}mctx.fillStyle='#fff6b9';mctx.fillRect(hero.x-OX-3,hero.y-OY-3,6,6)}
function render(t){
  if(lastPaint&&t-lastPaint<1000/paintFPS-1){requestAnimationFrame(render);return}
  lastPaint=t;
  const dt=last?Math.min(.05,(t-last)/1000):0;last=t;
  update(dt);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#192a26';ctx.fillRect(0,0,sw,sh);
  ctx.save();ctx.translate(sw/2,sh/2);ctx.scale(cameraZoom,cameraZoom);ctx.translate(-sw/2,-sh/2);
  ctx.imageSmoothingEnabled=false;prefetchBudget=3;ground();drawTargetRing();
  const order=[...getVisibleObjects().map(v=>({ob:v.ob,depth:v.depth})),...mobs.map(m=>({unit:m,type:m.visual||'enemy',depth:m.x+m.y+.1})),{unit:hero,type:'hero',depth:hero.x+hero.y+.1}];
  order.sort((a,b)=>a.depth-b.depth);
  for(const entry of order){if(entry.ob)drawObject(entry.ob);else drawActor(entry.unit,entry.type)}
  drawDamageText();ctx.restore();
  if(hero.dead){ctx.fillStyle='#000a';ctx.fillRect(0,0,sw,sh);ctx.fillStyle='#fff0ca';ctx.font='bold 27px system-ui';ctx.textAlign='center';ctx.fillText('전투 불능',sw/2,sh*.4)}
  drawMini(t);drawLab(t);perfFrames++;if(!perfSince)perfSince=t;if(t-perfSince>=1000){let fps=Math.round(perfFrames*1000/(t-perfSince));el('perfStatus').textContent='화면 '+fps+' FPS · 지형 검사 '+perfGround+'칸 / 표시 '+perfGroundVisible+'칸 · 오브젝트 검사 '+perfObjCells+'칸';perfFrames=0;perfSince=t}if(t-lastAssetUpdate>600){lastAssetUpdate=t;refreshAssetStatus()}
  if(t>toastUntil)el('tip').style.opacity='0';
  requestAnimationFrame(render);
}
function startLab(){open=true;el('lab').hidden=false;syncLab(true)}
function stopLab(){open=false;el('lab').hidden=true;msg('현재 동작 매핑을 게임에 반영했습니다',1.2)}
function actor(){return el('labActor').value}
function action(){return el('labMode').value}
function facingSlot(){return el('labDir').value}
function listKeys(){return Object.keys(D.actors[actor()].actions).map(Number).sort((a,b)=>a-b)}
function rawSeq(){return D.actors[actor()].actions[String(selectedKey)]||[]}
function countSlots(a){return Object.values(mapped[a]||{}).reduce((n,x)=>n+Object.keys(x).length,0)}
function syncLab(resetPage=false){let list=listKeys();if(resetPage)labPage=0;if(!list.includes(selectedKey))selectedKey=list[0];el('searchKey').value=String(selectedKey);
let saved=mapped[actor()]?.[action()]?.[facingSlot()];el('mapInfo').textContent=actor()+' '+action()+' 방향 '+facingSlot()+' → '+(saved===undefined?'미지정':'원본 SPR '+saved)+'\n지정 슬롯 '+countSlots(actor())+' / 40';el('previewInfo').textContent='SPR '+D.actors[actor()].sprite_id+'-'+selectedKey+'.spr · '+rawSeq().length+' 프레임 · 8개 단위 모션 후보, 원본 확정 아님';gallery();refreshPackLab()}
function gallery(){let list=listKeys(),chunk=16,total=Math.max(1,Math.ceil(list.length/chunk));labPage=clamp(labPage,0,total-1);el('pageInfo').textContent=(labPage+1)+' / '+total+' · '+list.length+'종';let root=el('gallery');root.replaceChildren();for(let key of list.slice(labPage*chunk,(labPage+1)*chunk)){let b=document.createElement('button');b.type='button';b.classList.toggle('selected',selectedKey===key);let name=D.actors[actor()].actions[String(key)]?.[0];if(name){let image=document.createElement('img');image.src=name;image.loading='lazy';image.alt='SPR '+key;b.appendChild(image)}let label=document.createElement('span');label.textContent='키 '+key;b.appendChild(label);b.onclick=()=>{selectedKey=key;syncLab()};root.appendChild(b)}}
function drawLab(t){if(!open)return;let cw=preview.width,ch=preview.height;pctx.fillStyle='#21392f';pctx.fillRect(0,0,cw,ch);let seq=rawSeq();if(!seq.length)return;let i=Number(el('labFrame').value);if(i<0)i=Math.floor(t/Number(el('labSpeed').value))%seq.length;i=clamp(i,0,seq.length-1);let image=img(seq[i]);if(!image.complete||!image.naturalWidth)return;let scale=Math.min(4,(cw-28)/image.naturalWidth,(ch-28)/image.naturalHeight);pctx.imageSmoothingEnabled=false;pctx.drawImage(image,(cw-image.naturalWidth*scale)/2,(ch-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);pctx.fillStyle='#ffe7b8';pctx.font='17px system-ui';pctx.fillText('원본 키 '+selectedKey+' | 프레임 '+i+'/'+(seq.length-1),12,ch-12)}
function persist(){try{localStorage.setItem(KEYSTORE,JSON.stringify(mapped))}catch(e){msg('브라우저 저장 실패')}syncLab()}
function importMapping(raw,save=true){let value=raw?.mapping||raw;if(!value||typeof value!=='object')throw Error('매핑 JSON 형식 오류');let next=Object.fromEntries(Object.keys(D.actors).map(k=>[k,{}]));for(let a of Object.keys(D.actors))for(let m of KEYS){let rows=value[a]?.[m];if(!rows||typeof rows!=='object')continue;for(let [dir,key] of Object.entries(rows)){if(/^[0-7]$/.test(dir)&&D.actors[a].actions[String(key)])(next[a][m]??={})[dir]=String(key)}}mapped=next;if(save)persist()}
function refreshPackLab(){
 const entry=packActors[actor()];const mode=action(),dir=Number(facingSlot());
 const row=entry?.actions?.[mode]?.directions?.[dir];
 const trialMode=window.SANCTUARY_MOTION_TRIAL?.mode(actor())||'legacy';el('packToggle').textContent=trialMode==='all'?'이 몬스터 전체 후보 끄기':trialMode==='approved'?'정상 표시 슬롯 시험 중':'이 몬스터 추출 후보 시험';el('packToggle').disabled=!entry;
 el('packStatus').textContent=Object.keys(packActors).length+'종 등록 · '+('선택 SPR '+D.actors[actor()].sprite_id+' · '+(trialMode==='approved'?'정상 표시만 시험':trialMode==='all'?'전체 후보 시험':'기존 동작 유지'))+' · 수동 배정 우선';el('packCount').textContent='실전 모션 로그 '+observedMotions.length+'건 (최대 '+MOTION_LOG_CAP+'건)';
 el('packPreview').hidden=!row;
 if(row){el('packPreview').src=row.gif||row.frames[0];}
 else el('packPreview').removeAttribute('src');
 el('packDetails').textContent=row?'SPR '+entry.sprite_id+' · '+mode+' 방향 '+dir+' · 원본 키 '+row.key+' · '+row.frames.length+' 프레임 · 후보 간격 '+(entry.actions[mode].delayMs||'?')+'ms · 방향·원본 타이밍 미확정':'선택한 원본 SPR의 해당 동작 추출팩이 없습니다.';
}
function toggleMotionCandidate(){
 const a=this?.id==='fieldPackToggle'?selectedMob?.visual:actor();
 if(!a||!packActors[a])return;
 const current=window.SANCTUARY_MOTION_TRIAL?.mode(a)||'legacy';
 const next=current==='all'?'legacy':'all';
 window.SANCTUARY_MOTION_TRIAL?.setMode(next,a);
 refreshPackLab();targetHUD();msg('SPR '+D.actors[a].sprite_id+(next==='all'?' 추출 후보 시험':' 기존 동작 복귀'),1.5);
}
el('packToggle').onclick=toggleMotionCandidate;
el('fieldPackToggle').onclick=toggleMotionCandidate;
el('packExport').onclick=exportMotionLog;
el('packClear').onclick=()=>{observedMotions.length=0;motionLast.clear();refreshPackLab();msg('실전 모션 로그 초기화',1)};
el('packFocusOrc').onclick=()=>{const picked=selectedMob?.visual&&packActors[selectedMob.visual]?selectedMob.visual:Object.keys(packActors)[0];if(!picked)return;el('labActor').value=picked;el('labMode').value='idle';el('labDir').value='0';selectedKey=32;syncLab(true);el('labActor').dispatchEvent(new Event('change'))};
el('labOpen').onclick=startLab;el('labClose').onclick=stopLab;
const options=el('labActor');for(const [key,entry] of Object.entries(D.actors)){let o=document.createElement('option');o.value=key;o.textContent='SPR '+entry.sprite_id+(key==='hero'?' · 현재 플레이어':key==='knight61'?' · 원본 기사 SPR61 시험':' · 원본 몬스터 후보');options.appendChild(o)}
for(let id of ['labActor','labMode','labDir'])el(id).onchange=()=>{let wanted=(GROUP_BASE[action()]??0)+Number(facingSlot());if(D.actors[actor()].actions[String(wanted)]){selectedKey=wanted;labPage=Math.floor(listKeys().indexOf(wanted)/16)}syncLab(id==='labActor')};
el('searchKey').onchange=()=>{let key=Number(el('searchKey').value);if(!rawSeq()||!D.actors[actor()].actions[String(key)]){msg('변환되지 않은 SPR 키입니다');el('searchKey').value=selectedKey;return}selectedKey=key;labPage=Math.floor(listKeys().indexOf(key)/16);syncLab()};
el('assign').onclick=()=>{let a=actor(),m=action(),dir=facingSlot();(mapped[a][m]??={})[dir]=String(selectedKey);persist();msg('SPR '+selectedKey+'를 '+m+' 방향 '+dir+'에 연결',1.1)};
el('unassign').onclick=()=>{let a=actor(),m=action(),d=facingSlot();if(mapped[a][m])delete mapped[a][m][d];persist()};
el('prevPage').onclick=()=>{labPage--;gallery()};el('nextPage').onclick=()=>{labPage++;gallery()};
el('clearMap').onclick=()=>{if(!confirm('전체 모션 매핑을 지울까요?'))return;mapped=Object.fromEntries(Object.keys(D.actors).map(k=>[k,{}]));persist()};
el('downloadMap').onclick=()=>{let file=JSON.stringify({version:7,ids:Object.fromEntries(Object.entries(D.actors).map(([k,v])=>[k,v.sprite_id])),mapping:mapped},null,2);let url=URL.createObjectURL(new Blob([file],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sanctuary-v7-motion-map.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)};
el('uploadMap').onchange=async e=>{let file=e.target.files?.[0];if(!file)return;try{importMapping(JSON.parse(await file.text()));msg('모션 매핑 불러오기 완료')}catch(error){alert('불러오기 실패: '+error.message)}e.target.value=''};
el('autoBtn').onclick=()=>{auto=!auto;el('autoBtn').textContent=auto?'자동 ON':'자동 OFF';el('autoBtn').classList.toggle('good',auto)};
el('targetNext').onclick=()=>{const alive=mobs.filter(m=>!m.dead).sort((a,b)=>dist(a,hero)-dist(b,hero));if(!alive.length){msg('선택할 몬스터가 없습니다');return}const next=alive[(alive.indexOf(selectedMob)+1)%alive.length];targetChoose(next,true);msg('SPR '+D.actors[next.visual].sprite_id+' 선택',.8)};
el('targetClear').onclick=()=>{targetForget();msg('타겟 해제',.7)};
el('hitBtn').addEventListener('pointerdown',e=>{e.preventDefault();tryAttack(true)});el('potion').onclick=drink;el('again').onclick=begin;
el('overlayToggle').onclick=()=>{showBlocked=!showBlocked;try{localStorage.setItem(V4KEY,String(showBlocked))}catch(e){}refresh()};
el('objectToggle').onclick=()=>{showObjects=!showObjects;el('objectToggle').textContent=showObjects?'오브젝트 ON':'오브젝트 OFF';msg(showObjects?'원본 오브젝트 표시':'원본 오브젝트 숨김',.9)};
el('textureToggle').onclick=()=>{showTextures=!showTextures;el('textureToggle').textContent=showTextures?'원본 타일 ON':'원본 타일 OFF';msg(showTextures?'원본 Tile.pak 그래픽 사용':'색상 미리보기 사용',.9)};
el('miniToggle').onclick=()=>{mapShown=!mapShown;lastMiniPaint=0;el('miniWrap').hidden=!mapShown};
let pad=el('pad'),knob=el('knob');function padMove(e){let r=pad.getBoundingClientRect(),radius=r.width*.31,x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,n=Math.hypot(x,y);if(n>radius){x=x*radius/n;y=y*radius/n}stickVector={x:x/radius,y:y/radius};knob.style.left=(r.width/2+x)+'px';knob.style.top=(r.height/2+y)+'px';hero.path=[];hero.goalMob=null;queuedAttack=false}
pad.addEventListener('pointerdown',e=>{if(open||settingsOpen)return;stickId=e.pointerId;pad.setPointerCapture(stickId);padMove(e);e.preventDefault()});pad.addEventListener('pointermove',e=>{if(e.pointerId===stickId){padMove(e);e.preventDefault()}});function stopPad(e){if(e.pointerId!==stickId)return;stickId=null;stickVector={x:0,y:0};knob.style.left='50%';knob.style.top='50%'}pad.addEventListener('pointerup',stopPad);pad.addEventListener('pointercancel',stopPad);
window.addEventListener('keydown',e=>{if(open||settingsOpen)return;pressed[e.key]=true;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();if(e.key===' '&&!e.repeat)tryAttack(true);if(e.key==='p'&&!e.repeat)drink()});window.addEventListener('keyup',e=>{pressed[e.key]=false});
function fieldTap(clientX,clientY){
  if(open||settingsOpen||hero.dead)return;
  const rect=scene.getBoundingClientRect();
  const localX=(clientX-rect.left-sw/2)/cameraZoom+sw/2;
  const localY=(clientY-rect.top-sh/2)/cameraZoom+sh/2;
  const dx=(localX-sw*.5)/(TW/2),dy=(localY-sh*.46)/(TH/2);
  const x=hero.x+(dx+dy)/2,y=hero.y+(dy-dx)/2;
  const target=mobs.filter(m=>!m.dead).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
  if(target&&Math.hypot(target.x-x,target.y-y)<1.2){targetChoose(target,true);msg('SPR '+D.actors[target.visual].sprite_id+' 선택 · 자동 접근',1)}else setDestination(x,y);
}
function fingerDistance(){const pts=[...frameFingers.values()];return pts.length<2?0:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)}
scene.addEventListener('pointerdown',e=>{
  if(open||settingsOpen||hero.dead)return;
  frameFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(frameFingers.size===1)tapFinger={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,blocked:false};
  if(frameFingers.size===2){pinching=true;pinchStartDistance=fingerDistance();pinchStartZoom=cameraZoom;if(tapFinger)tapFinger.blocked=true}
  if(frameFingers.size>2&&tapFinger)tapFinger.blocked=true;
  if(scene.setPointerCapture)scene.setPointerCapture(e.pointerId);
  e.preventDefault();
});
scene.addEventListener('pointermove',e=>{
  if(!frameFingers.has(e.pointerId))return;
  frameFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(tapFinger&&e.pointerId===tapFinger.id&&Math.hypot(e.clientX-tapFinger.x,e.clientY-tapFinger.y)>12)tapFinger.moved=true;
  if(frameFingers.size>=2&&pinchStartDistance>5){cameraZoom=clamp(pinchStartZoom*fingerDistance()/pinchStartDistance,.7,1.65);refreshZoomLabel()}
  e.preventDefault();
});
function fieldPointerEnd(e){
  if(!frameFingers.has(e.pointerId))return;
  const isTap=frameFingers.size===1&&tapFinger&&tapFinger.id===e.pointerId&&!tapFinger.blocked&&!tapFinger.moved&&!pinching;
  frameFingers.delete(e.pointerId);
  if(isTap)fieldTap(e.clientX,e.clientY);
  if(frameFingers.size===0){if(pinching)saveMobileSettings();pinching=false;tapFinger=null;pinchStartDistance=0}
  e.preventDefault();
}
scene.addEventListener('pointerup',fieldPointerEnd);
scene.addEventListener('pointercancel',e=>{if(tapFinger)tapFinger.blocked=true;fieldPointerEnd(e)});
mapCanvas.addEventListener('pointerdown',e=>{if(open||hero.dead)return;let r=mapCanvas.getBoundingClientRect(),x=OX+(e.clientX-r.left)/r.width*W,y=OY+(e.clientY-r.top)/r.height*H;setDestination(x,y);e.preventDefault()});
function readMobileSettings(){
  try{const raw=JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)||'{}');if(raw&&typeof raw==='object'){
    cameraZoom=clamp(Number(raw.zoom)||1,.7,1.65);
    paintFPS=Number(raw.fps)===60?60:30;
    controlSize=['small','normal','large'].includes(raw.controls)?raw.controls:'normal';
  }}catch(e){}
}
function saveMobileSettings(){
  try{localStorage.setItem(UI_SETTINGS_KEY,JSON.stringify({zoom:cameraZoom,fps:paintFPS,controls:controlSize}))}catch(e){}
}
function refreshZoomLabel(){el('zoomValue').textContent=Math.round(cameraZoom*100)+'%'}
function applyMobileSettings(){
  el('frameRate').value=String(paintFPS);
  el('controlSize').value=controlSize;
  document.documentElement.style.setProperty('--padSize',({small:106,normal:132,large:157}[controlSize])+'px');
  refreshZoomLabel();
}
function changeZoom(next){cameraZoom=clamp(Math.round(next*100)/100,.7,1.65);refreshZoomLabel();saveMobileSettings()}
function stopMovement(){pressed={};stickVector={x:0,y:0};stickId=null;el('knob').style.left='50%';el('knob').style.top='50%';frameFingers.clear();pinching=false;tapFinger=null;last=0;lastPaint=0;lastMiniPaint=0}
function settingsShow(value){settingsOpen=value;el('settingsPanel').hidden=!value;if(value)stopMovement()}
for(const id of ['again','miniToggle','overlayToggle','objectToggle','textureToggle'])el('settingsLegacy').appendChild(el(id));
readMobileSettings();applyMobileSettings();
el('settingsToggle').onclick=()=>settingsShow(!settingsOpen);
el('settingsClose').onclick=()=>settingsShow(false);
el('zoomIn').onclick=()=>changeZoom(cameraZoom+.1);
el('zoomOut').onclick=()=>changeZoom(cameraZoom-.1);
el('zoomReset').onclick=()=>changeZoom(1);
el('frameRate').onchange=()=>{paintFPS=Number(el('frameRate').value)===60?60:30;last=0;lastPaint=0;saveMobileSettings()};
el('controlSize').onchange=()=>{controlSize=el('controlSize').value;applyMobileSettings();saveMobileSettings()};
el('settingsReset').onclick=()=>{cameraZoom=1;paintFPS=30;controlSize='normal';applyMobileSettings();saveMobileSettings()};
el('assetRetry').onclick=retryFailedImages;
el('heroVisualTrial').onchange=()=>{
  const selected=el('heroVisualTrial').value;
  heroVisualTrial=selected==='knight61'?'knight61':'hero';
  const spr=D.actors[heroVisualTrial].sprite_id;
  el('heroVisualStatus').textContent='현재 화면 SPR '+spr+' · 캐릭터 정체·동작키 검증 전 · 게임 데이터 불변';
  msg('캐릭터 외형 비교: 원본 SPR '+spr+' (시험 적용)',1.8);
};
el('fullScreen').onclick=()=>{
  if(document.fullscreenElement){const p=document.exitFullscreen?.();p?.catch?.(()=>msg('전체 화면 해제 불가',1.2))}
  else{const p=el('stage').requestFullscreen?.();if(p)p.catch?.(()=>msg('이 브라우저는 전체 화면을 제한합니다',1.5));else msg('전체 화면 기능 미지원',1.2)}
};
window.addEventListener('blur',stopMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMovement()});
begin();refreshAssetStatus();window.SANCTUARY_GAME_READY=true;el('bootNotice').hidden=true;requestAnimationFrame(render);
})();
