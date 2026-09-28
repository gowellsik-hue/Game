path=ARGV[0]
html=File.read(path)

bridge=<<'JS'
<script>
(function(){
  var ch={BGM:new Audio(),BGS:new Audio()},pending=[];
  ch.BGM.loop=true;ch.BGS.loop=true;
  function urlFor(n){var p=String(n||'').split(String.fromCharCode(92)).join('/').replace(/\.(ogg|mp3|wav|wma|aac|m4a|flac|mid|midi)$/i,'');return encodeURI('gameasync/'+p+'.ogg?v=v148');}
  function safe(a){if(!a||!a.src)return;try{var p=a.play();if(p&&p.catch)p.catch(function(){if(pending.indexOf(a)<0)pending.push(a);});}catch(e){if(pending.indexOf(a)<0)pending.push(a);}}
  function retry(){var x=pending.slice();pending.length=0;x.forEach(safe);}
  ['touchstart','pointerdown','keydown','mousedown'].forEach(function(n){window.addEventListener(n,retry,{passive:true});});
  function stop(k){var a=ch[k];if(!a)return;a.pause();try{a.currentTime=0;}catch(e){}}
  function play(k,n,v,p){var a=ch[k];if(!a||!n)return;var u=urlFor(n);if(a.getAttribute('data-sl-src')!==u){a.pause();a.src=u;a.setAttribute('data-sl-src',u);a.load();}var gain=k==='BGS'?0.20:1;a.volume=Math.max(0,Math.min(1,Number(v||100)/100*gain));a.playbackRate=Math.max(.5,Math.min(1.5,Number(p||100)/100));safe(a);}
  function marker(t){var ai=t.indexOf('SLAUDIO|');if(ai>=0){var p=t.slice(ai).split('|'),cmd=p[1]||'',k=cmd.split('_')[0];if(/_PLAY$/.test(cmd))play(k,p.slice(2,-2).join('|'),p[p.length-2],p[p.length-1]);else if(/_STOP$/.test(cmd))stop(k);else if(/_FADE$/.test(cmd))setTimeout(function(){stop(k);},Number(p[2])||0);}var qi=t.indexOf('SLQS|');if(qi>=0){var q=t.slice(qi).split('|');if(window.slSetQuickLabel&&q.length>=3)window.slSetQuickLabel(q[1],q.slice(2).join('|'));}}
  function err(t){var p=document.getElementById('slerr');if(!p){p=document.createElement('pre');p.id='slerr';p.style='position:fixed;left:8px;top:8px;right:8px;max-height:70vh;overflow:auto;z-index:999999;background:#000;color:#fff;border:2px solid #d33;padding:10px;font:14px monospace;white-space:pre-wrap';document.body.appendChild(p);}p.textContent=String(t);}
  var log=console.log.bind(console);console.log=function(){var a=[].slice.call(arguments),t=a.join(' ');try{marker(t);}catch(e){log('SLMARKERERR|'+e);}if(/SLRUNTIMEERR|SLSCRIPTERR/.test(t))err(t);log.apply(console,a);};
  window.addEventListener('error',function(e){err('JS ERROR | '+e.message);});window.slAudioBridge=ch;
})();
</script>
JS
html.sub!('<head>',"<head>\n#{bridge}") or abort 'head target missing'

html.gsub!(/<script src=\"js\/drive\.js(?:\?[^\"]*)?\"><\/script>/,'<script src="js/drive.js?v=v148"></script>')
html.gsub!(/<script src=\"js\/dpad\.js(?:\?[^\"]*)?\"><\/script>/,'<script src="js/dpad.js?v=v148"></script>')
html.gsub!(/<script src=\"gameasync\/mapping\.js(?:\?[^\"]*)?\"><\/script>/,'<script src="gameasync/mapping.js?v=v148"></script>')
html.gsub!(/var namespace = '[^']*';/,"var namespace = 'slknight_v14_engine';")
html.gsub!(/var wTitle = '[^']*'/,"var wTitle = 'SLKnight V14.8'")
html.gsub!('width="640" height="480"','width="800" height="600"')
html.gsub!(/getLazyAsset\('mkxp\.wasm(?:\?[^']*)?', 'Game engine'/,"getLazyAsset('mkxp.wasm?v=v148', 'Game engine'")
html.gsub!(/s\.setAttribute\('src', 'mkxp\.js(?:\?[^']*)?'\);/,"s.setAttribute('src', 'mkxp.js?v=v148');")
html.gsub!('<title>MKXP</title>','<title>SLKnight V14.8</title>')

# bitmap-map is intentionally not loaded; Pictures stay lazy.
html.gsub!(/\s*getLazyAsset\('gameasync\/bitmap-map\.js'.*?document\.body\.appendChild\(s\);\s*\}\);/m,'')

# Proven V14.4b boot path: Emscripten preload package owns core files.
pre="            preRun: [function(){window.restoreLocalFilesBeforeRun();}],"
html.sub!(/^\s*preRun:.*$/,pre) or abort 'preRun target missing'
post="            postRun: [function(){var sp=document.getElementById('spinner');if(sp)sp.style.display='none';var p=document.getElementById('progress');if(p){p.innerHTML='Game ready';setTimeout(function(){p.style.opacity='0';},800);}}],"
html.sub!(/^\s*postRun:.*$/,post) or abort 'postRun target missing'
html.sub!(/setStatus:\s*function\(text\)\s*\{\s*\}/,"setStatus: function(text){var p=document.getElementById('progress');if(!p)return;if(text){p.innerHTML=String(text);p.style.opacity='0.75';}}")

css=<<'CSS'
<style id="sl-mobile-v148-style">
#dpad,#apad{display:none!important}
#sl-mobile-ui{position:fixed;inset:0;z-index:5000;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#sl-joystick{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));width:178px;height:178px;border-radius:50%;pointer-events:auto;touch-action:none}
#sl-joy-base{position:absolute;inset:19px;border-radius:50%;border:2px solid rgba(255,255,255,.34);background:rgba(0,0,0,.20);box-shadow:inset 0 0 22px rgba(0,0,0,.25)}
#sl-joy-knob{position:absolute;left:54px;top:54px;width:70px;height:70px;border-radius:50%;border:2px solid rgba(255,255,255,.66);background:rgba(35,35,35,.64);box-shadow:0 3px 14px rgba(0,0,0,.45);transform:translate(0,0)}
#sl-actions{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:290px;height:205px;pointer-events:none}
.sl-btn{position:absolute;box-sizing:border-box;border-radius:50%;border:2px solid rgba(255,255,255,.48);background:rgba(0,0,0,.42);color:#fff;font:600 12px system-ui,sans-serif;pointer-events:auto;touch-action:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl-btn.active{transform:scale(.93);background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.9)}
#sl-confirm{width:84px;height:84px;right:0;bottom:0;font-size:15px}#sl-cancel{width:60px;height:60px;right:94px;bottom:4px}#sl-bag{width:54px;height:54px;right:7px;bottom:96px}#sl-equip{width:54px;height:54px;right:70px;bottom:116px}#sl-config{width:42px;height:42px;right:160px;bottom:62px;font-size:17px}#sl-q1,#sl-q2,#sl-q3,#sl-q4{width:54px;height:54px;bottom:148px;font-size:10px;padding:2px}#sl-q1{right:228px}#sl-q2{right:171px}#sl-q3{right:114px}#sl-q4{right:57px}#progress{max-width:80vw;z-index:9000;font:12px system-ui,sans-serif}
@media(orientation:portrait){#sl-joystick{width:154px;height:154px}#sl-joy-base{inset:17px}#sl-joy-knob{left:47px;top:47px;width:60px;height:60px}#sl-actions{transform:scale(.86);transform-origin:right bottom}}
</style>
CSS
html.sub!('</head>',css+"\n</head>") or abort 'head close missing'

controls=<<'HTML'
<div id="sl-mobile-ui">
  <div id="sl-joystick"><div id="sl-joy-base"></div><div id="sl-joy-knob"></div></div>
  <div id="sl-actions">
    <button id="sl-q1" class="sl-btn">1</button><button id="sl-q2" class="sl-btn">2</button><button id="sl-q3" class="sl-btn">3</button><button id="sl-q4" class="sl-btn">4</button>
    <button id="sl-config" class="sl-btn">⚙</button><button id="sl-bag" class="sl-btn">가방</button><button id="sl-equip" class="sl-btn">장비</button><button id="sl-cancel" class="sl-btn">취소</button><button id="sl-confirm" class="sl-btn">확인</button>
  </div>
</div>
<script>window.addEventListener('load',function(){if(window.initSLMobileControls)window.initSLMobileControls();});</script>
HTML
html.sub!('</body>',"<script src=\"slknight-core-v148.js?v=v148\"></script>\n#{controls}\n</body>") or abort 'body close missing'
File.write(path,html)
puts 'BROWSER_V148_OK'
