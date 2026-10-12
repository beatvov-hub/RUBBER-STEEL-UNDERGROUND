import './style.css';
import { ABILITIES, CHARACTERS, CONFIG, WEAPONS, type CharacterId, type Vec, type Weapon } from './data';
import { Game } from './engine';
import { Renderer } from './visuals/renderer';
import { abilityIcon, ABILITY_SUMMARIES } from './visuals/icons';
import { completeStage, loadSave, persistSave } from './save';
import { seedOf, STAGES } from './world';
import mainBgmUrl from './assets/audio/RSU-main.mp3';
import bossBgmUrl from './assets/audio/RSU-boss.mp3';
const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new Game();
const WEAPON_HINTS:Record<Weapon,string>={standard:'精密単発',triple:'3方向 / 集団向け',heavy:'高威力 / 装甲・ボス'};
let save = loadSave(localStorage);
let menu: 'home'|'stages'|'characters'|'settings'|'credits' = 'home';
let recordedDeath=false,recordedClear='';
function persist() { persistSave(localStorage,save); }
app.innerHTML = "<main class=\"shell\"><header class=\"masthead\"><a class=\"brand\" href=\"#\" aria-label=\"RSU\"><span class=\"brand-mark\">R<span>/</span>S</span><span>RUBBER STEEL <b>UNDERGROUND</b></span></a><div class=\"meta\"><span class=\"facility-status\">SECTOR 01 · LOCAL SIMULATION</span><button class=\"quiet\" id=\"sound\">SOUND ON</button><button class=\"quiet\" id=\"pause\">PAUSE Ⅱ</button></div></header><div class=\"arena\"><canvas width=\"1120\" height=\"640\" id=\"game\" aria-label=\"RSU 見下ろし型アクションゲーム\"></canvas><div class=\"touch-stick\" id=\"touch-stick\" aria-hidden=\"true\"><span></span></div><div class=\"ingame-hud\"><div class=\"hud-corner top-left\"><div class=\"overline\">UNDERGROUND / STAGE 01</div><div class=\"floor-display\">FLOOR <strong id=\"floor\">01 / 10</strong></div><div id=\"sector-name\">CALIBRATION BAY</div></div><div class=\"hud-corner top-right\"><span class=\"hud-stat\">ENEMIES <b id=\"enemies\">01</b></span><span class=\"hud-stat rounds-label\">LIVE ROUNDS <b id=\"rounds\">000</b></span><span class=\"exit-status\" id=\"exit\">LOCKED</span></div><div class=\"hud-corner bottom-left\"><div class=\"vital-label\">VITAL / STANDARD</div><div class=\"health\"><span class=\"health-icon\">+</span><span id=\"hp\">◆</span><small>ONE LIFE</small></div></div><div class=\"hud-corner bottom-right\"><div class=\"current-weapon\"><span class=\"overline\">EQUIPPED</span><strong id=\"weapon\">STANDARD</strong><small id=\"weapon-hint\">精密単発</small></div><div class=\"weapons\"><button class=\"weapon active\" data-weapon=\"standard\" aria-label=\"1 STANDARD: 精密な単発射撃\" title=\"1 STANDARD: 精密な単発射撃\">1<span>STD</span></button><button class=\"weapon \" data-weapon=\"triple\" aria-label=\"2 TRIPLE SHOT: 3方向で集団向け。外した3発も跳ね返る\" title=\"2 TRIPLE SHOT: 3方向で集団向け。外した3発も跳ね返る\">2<span>TRI</span></button><button class=\"weapon \" data-weapon=\"heavy\" aria-label=\"3 HEAVY SHOT: 高威力の重弾。装甲とボスに有効だが弾速は遅い\" title=\"3 HEAVY SHOT: 高威力の重弾。装甲とボスに有効だが弾速は遅い\">3<span>HVY</span></button></div><div class=\"abilities\" id=\"abilities\"></div></div></div><div class=\"overlay\" id=\"overlay\"></div></div><div class=\"underbar\"><span class=\"desktop-instructions\">WASD / 矢印 <b>移動</b> <i>·</i> MOUSE <b>照準</b> <i>·</i> CLICK <b>射撃</b> <i>·</i> ESC <b>一時停止</b></span><span class=\"touch-instructions\">左側ドラッグ <b>移動</b> <i>·</i> 右側ドラッグ <b>照準・射撃</b> <i>·</i> 横向き推奨</span><div class=\"legend\"><span><i class=\"own\"></i>自弾 / 永久跳弾</span><span><i class=\"enemy\"></i>敵弾</span><small id=\"perf\">RSU / v1.0.0</small></div></div></main>";
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
document.querySelector('.meta')!.insertAdjacentHTML('afterbegin','<button class="quiet" id="fullscreen-toggle" aria-label="フルスクリーン切替" title="フルスクリーン切替">FULL SCREEN ⛶</button>');
document.querySelector('.ingame-hud')!.insertAdjacentHTML('beforeend','<div class="tutorial" id="tutorial"></div>');
const ctx = canvas.getContext('2d')!;
const renderer = new Renderer(ctx);
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const keys = new Set<string>(); let mouse: Vec = { x: 850, y: 150 }, firing = false, mouseFiring=false, fireTouchId:number|undefined;
let moveTouch:{id:number;x:number;y:number;originX:number;originY:number}|undefined;
const touchStick=document.getElementById('touch-stick')!;
let audio: AudioContext | undefined; let lastSound = 0;
const bgmTracks:Record<'main'|'boss',HTMLAudioElement>={main:new Audio(mainBgmUrl),boss:new Audio(bossBgmUrl)};
const bgmLevels:Record<'main'|'boss',number>={main:0,boss:0};
for(const track of Object.values(bgmTracks)){track.loop=true;track.preload='none';track.volume=0;}
let bgmKind:'main'|'boss'='main',bgmFadeTimer:number|undefined;
function sound(kind: string) {
  if (save.settings.master===0 || save.settings.sfx===0 || !audio) return;
  const now = audio.currentTime; if (kind === 'bounce' && now - lastSound < .035) return; lastSound = now;
  const osc = audio.createOscillator(), gain = audio.createGain();
  const cue:Record<string,[number,number,OscillatorType,number]>={shot:[145,65,'triangle',.10],triple:[240,110,'sawtooth',.13],heavy:[95,38,'sawtooth',.22],bounce:[1100,510,'sine',.065],clang:[640,175,'square',.19],hit:[300,78,'triangle',.12],damage:[85,40,'sawtooth',.22],gameover:[120,30,'sine',.42],enemy:[170,90,'sine',.13],open:[520,920,'sine',.28],ability:[480,960,'sine',.31],'floor-clear':[650,930,'sine',.24],'stage-clear':[410,1050,'sine',.45]};
  const [start,end,wave,length]=cue[kind]??cue.hit;
  osc.type=wave;osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+length);
  gain.gain.setValueAtTime((kind === 'bounce' ? CONFIG.reflectionVolume : kind==='heavy'?.075:.055)*save.settings.master*save.settings.sfx, now); gain.gain.exponentialRampToValueAtTime(.001, now + length); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + length+.01);
}
function updateBgmVolumes(){const volume=save.settings.master*save.settings.bgm;for(const kind of ['main','boss'] as const)bgmTracks[kind].volume=Math.max(0,Math.min(1,volume*bgmLevels[kind]));}
function setBgm(kind:'main'|'boss'){
  if(kind===bgmKind){if(bgmTracks[kind].paused&&audio){if(bgmLevels.main===0&&bgmLevels.boss===0)bgmLevels[kind]=1;void bgmTracks[kind].play().catch(()=>{});updateBgmVolumes();}return;}
  bgmKind=kind;
  if(!audio)return;
  if(bgmFadeTimer!==undefined)window.clearInterval(bgmFadeTimer);
  const target=bgmTracks[kind];target.currentTime=0;
  void target.play().then(()=>{
    if(bgmKind!==kind){target.pause();return;}
    const start={...bgmLevels},started=performance.now(),duration=650;
    bgmFadeTimer=window.setInterval(()=>{
      const progress=Math.min(1,(performance.now()-started)/duration);
      for(const trackKind of ['main','boss'] as const)bgmLevels[trackKind]=trackKind===kind?start[trackKind]+(1-start[trackKind])*progress:start[trackKind]*(1-progress);
      updateBgmVolumes();
      if(progress>=1){window.clearInterval(bgmFadeTimer);bgmFadeTimer=undefined;for(const trackKind of ['main','boss'] as const){bgmLevels[trackKind]=trackKind===kind?1:0;if(trackKind!==kind){bgmTracks[trackKind].pause();bgmTracks[trackKind].currentTime=0;}}updateBgmVolumes();}
    },32);
  }).catch(()=>{});
}
function enableAudio() { if(!audio)audio=new AudioContext();void audio.resume();setBgm(game.state==='title'||game.stage%10!==0?'main':'boss');updateSound(); }
game.onSound = kind => { renderer.event(kind, game, mouse); sound(kind); };
function bind(id: string, fn: () => void) { document.getElementById(id)?.addEventListener('click', fn); }
function sync() {
  firing = false;mouseFiring=false;fireTouchId=undefined;moveTouch=undefined;touchStick.classList.remove('active');
  overlay.className = `overlay ${game.state} ${menu==='stages'?'menu':''}`;
  document.querySelector('.arena')!.classList.toggle('title-mode', game.state === 'title');
  if(game.state==='playing')recordedClear='';
  setBgm(game.state==='title'||game.stage%10!==0?'main':'boss');
  save.bestFloor = Math.max(save.bestFloor, game.floor + 1);
  if (game.state === 'stage-clear'||game.state==='won') { const key=`${game.stage}:${game.elapsed}`;if(recordedClear!==key){save=completeStage(save,game.stage,game.elapsed);sound('stage-clear');recordedClear=key;} }
  if (game.state === 'dead'){if(!recordedDeath)save.deaths++;recordedDeath=true;}else recordedDeath=false;
  persist();
  document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.classList.toggle('active', b.dataset.weapon === game.weapon));
  document.getElementById('abilities')!.innerHTML = game.abilities.map(id => `<span class="ability-badge" title="${ABILITIES.find(a => a.id === id)!.name}">${abilityIcon(id)}</span>`).join('');
  const button = (id: string, text: string, primary = true) => `<button id="${id}" class="${primary ? 'primary' : 'secondary'}">${text}</button>`;
  if (game.state === 'title'&&menu==='stages') overlay.innerHTML = `<div class="panel stage-panel"><div class="eyebrow">STAGE SELECT / ${save.completedStages.length} OF 50 CLEARED</div><h2>地下へ進む。</h2><div class="stage-grid">${STAGES.map(stage=>`<button class="stage-tile ${stage.number>save.reachedStage?'locked':''} ${save.completedStages.includes(stage.number)?'cleared':''}" data-stage="${stage.number}" ${stage.number>save.reachedStage?'disabled':''} aria-label="Stage ${stage.number} ${stage.name} ${stage.number>save.reachedStage?'locked':'available'}"><span>${String(stage.number).padStart(2,'0')}</span><small>${stage.number>save.reachedStage?'LOCK':stage.name}</small></button>`).join('')}</div>${button('home','BACK TO TITLE',false)}</div>`;
  else if(game.state==='title'&&menu==='characters')overlay.innerHTML=`<div class="panel stage-panel"><div class="eyebrow">OPERATIVE / SELECT CHARACTER</div><h2>戦い方を選ぶ。</h2><div class="character-grid">${Object.values(CHARACTERS).map(c=>`<button class="character-card ${save.selected===c.id?'selected':''}" data-character="${c.id}" ${save.unlocked.includes(c.id)?'':'disabled'} style="--character-accent:${c.accent}"><span class="character-symbol">${c.id==='fire'?'♨':c.id==='ice'?'❄':c.id==='thunder'?'ϟ':'◎'}</span><strong>${c.name}</strong><small>${save.unlocked.includes(c.id)?c.description:`STAGE ${c.id==='fire'?10:c.id==='ice'?20:30} CLEARで解放`}</small><span>${save.selected===c.id?'SELECTED':save.unlocked.includes(c.id)?'SELECT':'LOCKED'}</span></button>`).join('')}</div>${button('home','BACK TO TITLE',false)}</div>`;
  else if(game.state==='title'&&menu==='settings')overlay.innerHTML=`<div class="panel stage-panel"><div class="eyebrow">OPTIONS / 保存されます</div><h2>SETTINGS</h2><div class="settings-grid">${(['master','bgm','sfx','shake','flash'] as const).map(id=>`<label>${id.toUpperCase()} <output>${Math.round(save.settings[id]*100)}%</output><input data-setting="${id}" type="range" min="0" max="100" value="${Math.round(save.settings[id]*100)}"></label>`).join('')}<label class="toggle-setting">KEY GUIDE <input data-setting="keyGuide" type="checkbox" ${save.settings.keyGuide?'checked':''}></label></div><p>WASD / 矢印: 移動　マウス: 照準　左クリック: 射撃　1/2/3: 武器　Esc: 一時停止</p>${button('fullscreen','FULLSCREEN',false)}${button('home','BACK TO TITLE',false)}</div>`;
  else if(game.state==='title'&&menu==='credits')overlay.innerHTML=`<div class="panel stage-panel"><div class="eyebrow">RUBBER STEEL UNDERGROUND</div><h2>CREDITS</h2><p>永久跳弾ローグライト / 50 STAGES / 500 FLOORS<br>ゲーム、描画、効果音: プログラム生成</p>${button('home','BACK TO TITLE',false)}</div>`;
  else if (game.state === 'title') overlay.innerHTML = `<div class="title-panel"><div class="eyebrow"><span></span> BALLISTIC RESEARCH DIVISION / ${String(save.reachedStage).padStart(2,'0')}</div><h1>RUBBER STEEL<br><span>UNDERGROUND</span></h1><div class="title-tagline">撃つほど、逃げ場がなくなる。</div><p>弾は消えない。敵に当たる、その瞬間まで。<br>自分の一発が、次の脅威になる。</p>${button('start', save.reachedStage>1?'CONTINUE <span>↗</span>':'START RUN <span>↗</span>')}${button('stage-select','STAGE SELECT',false)}${button('character-select','CHARACTER',false)}${button('settings','SETTINGS',false)}${button('credits','CREDITS',false)}${button('quit','EXIT',false)}<div class="run-meta"><span>50 STAGES / 500 FLOORS</span><span>REACHED STAGE ${String(save.reachedStage).padStart(2,'0')}</span><span>${CHARACTERS[save.selected].name}</span></div><div class="title-instructions">敵全滅で出口が開放。残った自弾を避けて進め。</div></div>`;
  else if (game.state === 'dead') overlay.innerHTML = `<div class="panel"><div class="eyebrow">EXPERIMENT TERMINATED / FLOOR ${game.floor + 1}</div><h2>${game.deathCause.startsWith('OWN') ? 'YOUR SHOT.<br><span class="accent">YOUR CONSEQUENCE.</span>' : 'SIGNAL LOST.'}</h2><p>${game.deathCause}<br>死亡弾を白いリングで表示。取得能力は失われました。</p>${button('retry', 'RETRY FLOOR ↻')}${button('title', 'RETURN TO TITLE', false)}</div>`;
  else if (game.state === 'paused') overlay.innerHTML = `<div class="panel"><div class="eyebrow">SIMULATION ON HOLD</div><h2>PAUSED</h2><p>弾も敵も停止しています。</p>${button('resume', 'RESUME →')}${button('title', 'RETURN TO TITLE', false)}</div>`;
  else if (game.state === 'choice') overlay.innerHTML = `<div class="panel choice-panel"><div class="eyebrow">FLOOR ${String(game.floor+1).padStart(2,'0')} COMPLETE</div><h2>次の一発を、考える。</h2><p>能力をひとつ選択 / このRUNのみ有効</p><div class="cards">${game.choices.map(id=>{const a=ABILITIES.find(a=>a.id===id)!;return `<button class="card" data-ability="${id}"><span class="card-icon">${abilityIcon(id)}</span><strong>${a.name}</strong><p>${ABILITY_SUMMARIES[id]}</p><span class="card-select">SELECT MOD <span>↗</span></span></button>`;}).join('')}</div></div>`;
  else if (game.state === 'stage-clear'||game.state==='won') overlay.innerHTML = `<div class="panel"><div class="eyebrow">STAGE ${String(game.stage).padStart(2,'0')} / ALL 10 FLOORS COMPLETE</div><h2>${game.state==='won'?'RUBBER STEEL<br><span class="accent">CONTAINED.</span>':'STAGE CLEAR<br><span class="accent">NEXT SECTOR UNLOCKED.</span>'}</h2><p>${Math.floor(game.elapsed / 60)}m ${Math.floor(game.elapsed % 60)}s &nbsp; / &nbsp; ${game.shots} SHOTS &nbsp; / &nbsp; ${game.reflectionCount} REFLECTIONS</p>${game.stage<50?button('next-stage','NEXT STAGE →'):''}${button('stage-select','STAGE SELECT',false)}${button('title','RETURN TO TITLE',false)}</div>`;
  else overlay.innerHTML = '';
  bind('start', () => { enableAudio(); menu='home'; game.start(save.reachedStage,save.selected); }); bind('retry', () => game.retry()); bind('title', () => { game.state = 'title'; menu='home'; sync(); }); bind('resume', togglePause);
  bind('next-stage',()=>{enableAudio();game.start(Math.min(50,game.stage+1),save.selected);});
  bind('stage-select',()=>{game.state='title';menu='stages';sync();});bind('home',()=>{menu='home';sync();});
  overlay.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b=>b.onclick=()=>{const stage=Number(b.dataset.stage);if(stage<=save.reachedStage){enableAudio();menu='home';game.start(stage,save.selected);}});
  for(const id of ['character-select','settings','credits'] as const)bind(id,()=>{menu=id==='character-select'?'characters':id;sync();});
  bind('quit',()=>{window.close();});bind('fullscreen',toggleFullscreen);
  overlay.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b=>b.onclick=()=>{const id=b.dataset.character as CharacterId;if(save.unlocked.includes(id)){save.selected=id;sync();}});
  overlay.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>input.oninput=()=>{const id=input.dataset.setting as keyof typeof save.settings;if(id==='keyGuide')save.settings.keyGuide=input.checked;else save.settings[id]=Number(input.value)/100;persist();updateSound();const output=input.parentElement?.querySelector('output');if(output)output.textContent=`${input.value}%`;});
  overlay.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach(b => b.onclick = () => game.choose(b.dataset.ability as typeof game.choices[number]));
}
game.onChange = sync;
function togglePause() { if (game.state === 'playing') game.state = 'paused'; else if (game.state === 'paused') game.state = 'playing'; sync(); }
function toggleFullscreen(){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen();}
bind('pause', togglePause); bind('sound', () => { save.settings.master=save.settings.master===0?1:0; persist(); updateSound(); });
bind('fullscreen-toggle',toggleFullscreen);
function updateSound() { document.getElementById('sound')!.textContent = save.settings.master===0 ? 'SOUND OFF' : 'SOUND ON';updateBgmVolumes(); }
document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.onclick = () => game.setWeapon(b.dataset.weapon as Weapon));
window.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); keys.add(e.key.toLowerCase()); if (e.repeat) return; if (e.key === 'Escape') togglePause(); if (['1','2','3'].includes(e.key) && game.state === 'playing') game.setWeapon((['standard','triple','heavy'] as Weapon[])[Number(e.key) - 1]); if (e.key.toLowerCase() === 'r' && game.state === 'dead') game.retry(); });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); firing = false; mouseFiring=false;fireTouchId=undefined;moveTouch=undefined;touchStick.classList.remove('active'); if (game.state === 'playing') togglePause(); });
function updateAim(e:PointerEvent){const r=canvas.getBoundingClientRect();mouse=renderer.screenToWorld({x:(e.clientX-r.left)/r.width*CONFIG.width,y:(e.clientY-r.top)/r.height*CONFIG.height});}
canvas.addEventListener('pointermove', e => { updateAim(e);if(moveTouch?.id===e.pointerId){const r=canvas.getBoundingClientRect(),dx=e.clientX-moveTouch.originX,dy=e.clientY-moveTouch.originY,max=42,length=Math.hypot(dx,dy),scale=length>max?max/length:1;moveTouch.x=dx*scale/max;moveTouch.y=dy*scale/max;touchStick.style.setProperty('--stick-x',`${dx*scale}px`);touchStick.style.setProperty('--stick-y',`${dy*scale}px`);} });
canvas.addEventListener('pointerdown', e => { if(e.button!==0)return;enableAudio();canvas.setPointerCapture(e.pointerId);updateAim(e);if(e.pointerType==='touch'){const r=canvas.getBoundingClientRect();if(e.clientX<r.left+r.width*.48&&!moveTouch){moveTouch={id:e.pointerId,x:0,y:0,originX:e.clientX,originY:e.clientY};touchStick.classList.add('active');touchStick.style.left=`${Math.max(10,Math.min(r.width-92,e.clientX-r.left-41))}px`;touchStick.style.top=`${Math.max(10,Math.min(r.height-92,e.clientY-r.top-41))}px`;return;}fireTouchId=e.pointerId;firing=true;return;}mouseFiring=true;firing=true; });
function releasePointer(e:PointerEvent){if(moveTouch?.id===e.pointerId){moveTouch=undefined;touchStick.classList.remove('active');touchStick.style.setProperty('--stick-x','0px');touchStick.style.setProperty('--stick-y','0px');}if(fireTouchId===e.pointerId){fireTouchId=undefined;firing=mouseFiring;}if(e.pointerType==='mouse'){mouseFiring=false;firing=fireTouchId!==undefined;}}
window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);canvas.addEventListener('contextmenu', e => e.preventDefault());
let refreshDebug=()=>{};
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('debug')){
  app.insertAdjacentHTML('beforeend',`<section class="debug-panel" id="debug"><strong>DEV DEBUG</strong><button id="debug-unlock">ALL STAGES UNLOCK</button><label>STAGE <input id="debug-stage" type="number" min="1" max="50" value="1"></label><label>FLOOR <input id="debug-floor" type="number" min="1" max="10" value="1"></label><select id="debug-character">${Object.values(CHARACTERS).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select><button id="debug-jump">JUMP</button><label><input id="debug-invincible" type="checkbox"> INVINCIBLE</label><label><input id="debug-hitboxes" type="checkbox"> HITBOX</label><output id="debug-stats"></output></section>`);
  bind('debug-unlock',()=>{save.reachedStage=50;persist();if(game.state==='title')sync();});
  bind('debug-jump',()=>{const stage=Math.max(1,Math.min(50,Number((document.getElementById('debug-stage') as HTMLInputElement).value)||1)),floor=Math.max(1,Math.min(10,Number((document.getElementById('debug-floor') as HTMLInputElement).value)||1)),character=(document.getElementById('debug-character') as HTMLSelectElement).value as CharacterId;game.start(stage,character);game.floor=floor-1;game.loadFloor();});
  (document.getElementById('debug-invincible') as HTMLInputElement).onchange=e=>game.debugInvincible=(e.target as HTMLInputElement).checked;
  (document.getElementById('debug-hitboxes') as HTMLInputElement).onchange=e=>renderer.debugHitboxes=(e.target as HTMLInputElement).checked;
  refreshDebug=()=>{const queued=game.reinforcementQueue.reduce((n,w)=>n+w.types.length,0),fallback=game.layout.seed===seedOf(game.stage,game.floor+1,999);document.getElementById('debug-stats')!.textContent=`STAGE ${game.stage} FLOOR ${game.floor+1} · T ${game.floorTime.toFixed(1)}s · ENEMY ${game.activeRemaining}/${game.remaining} · WAVE ${queued} · K ${game.kills} · RICOCHET ${game.reflectionCount} · FIRE S/T/H ${game.weaponFires.standard}/${game.weaponFires.triple}/${game.weaponFires.heavy} · KILL S/T/H ${game.weaponKills.standard}/${game.weaponKills.triple}/${game.weaponKills.heavy} · BULLET ${game.bullets.length}/${CONFIG.maxBullets} · RENDER ${renderer.lastRenderMs.toFixed(1)}ms · FALLBACK ${Number(fallback)} · SEED ${game.layout.seed??'AUTHORED'}${game.state==='dead'?` · DEATH ${game.deathCause}`:''}`;};
}
game.loadFloor(); game.state='title'; sync(); updateSound();
let previous=performance.now(),accumulator=0,frames=0,frameTime=0;
function updateTutorial(){const hint=document.getElementById('tutorial')!;if(!save.settings.keyGuide||game.state!=='playing'||game.stage!==1||game.floor>1){hint.textContent='';return;}const t=game.floorTime,touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
  hint.textContent=game.floor===0?(t<3?(touch?'左ドラッグ: 移動　右ドラッグ: 照準・射撃':'MOVE: WASD / 矢印　 AIM: MOUSE　 SHOOT: CLICK'):t<9?'YOUR BULLETS DO NOT DISAPPEAR UNTIL THEY HIT AN ENEMY.':'KILL ALL ENEMIES → REACH EXIT'):(t<7?'YOUR OWN BULLETS CAN KILL YOU.':game.remaining?'KILL ALL ENEMIES':'REACH EXIT / 残った弾を避けて脱出');}
function tick(now: number){const delta=Math.min((now-previous)/1000,.08);previous=now;accumulator+=delta;const movement={x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+(moveTouch?.x??0),y:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+(moveTouch?.y??0)};while(accumulator>=CONFIG.fixedStep){if(game.state==='playing')save.totalSeconds+=CONFIG.fixedStep;game.update(CONFIG.fixedStep,movement,mouse,firing);accumulator-=CONFIG.fixedStep;}renderer.shakeScale=save.settings.shake;renderer.flashScale=save.settings.flash;renderer.draw(game,mouse,delta);updateTutorial();refreshDebug();document.getElementById('floor')!.textContent=`${String(game.floor+1).padStart(2,'0')} / 10`;document.querySelector('.top-left .overline')!.textContent=`UNDERGROUND / STAGE ${String(game.stage).padStart(2,'0')}`;document.getElementById('hp')!.textContent=game.player.hp>0?'◆':'◇';document.getElementById('weapon')!.textContent=WEAPONS[game.weapon].name;document.getElementById('weapon-hint')!.textContent=WEAPON_HINTS[game.weapon];document.getElementById('enemies')!.textContent=String(game.remaining).padStart(2,'0');document.getElementById('rounds')!.textContent=`${String(game.bullets.filter(b=>b.owner==='player').length).padStart(3,'0')} / ${CONFIG.maxBullets}`;document.getElementById('exit')!.textContent=game.remaining?'LOCKED':'OPEN';document.getElementById('exit')!.classList.toggle('unlocked',!game.remaining);document.getElementById('sector-name')!.textContent=game.layout.name;document.querySelector('.facility-status')!.textContent=`${STAGES[game.stage-1].areaName} / STAGE ${String(game.stage).padStart(2,'0')}`;document.querySelector('.vital-label')!.textContent=`VITAL / ${CHARACTERS[game.character].name}`;frames++;frameTime+=delta;if(frameTime>1){document.getElementById('perf')!.textContent=`${Math.round(frames/frameTime)} FPS / ${game.bullets.length} OF ${CONFIG.maxBullets} ROUNDS`;persist();frames=0;frameTime=0;}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
