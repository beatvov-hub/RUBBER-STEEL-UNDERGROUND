import './style.css';
import { ABILITIES, CONFIG, WEAPONS, type Vec, type Weapon } from './data';
import { Game } from './engine';
import { Renderer } from './visuals/renderer';
import { abilityIcon, ABILITY_SUMMARIES } from './visuals/icons';
const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new Game();
type Save = { version: number; muted: boolean; bestFloor: number; bestSeconds: number | null; unlocked: string[]; reachedStage: number };
let save: Save = { version: 1, muted: false, bestFloor: 1, bestSeconds: null, unlocked: ['standard'], reachedStage: 1 };
try { const stored = JSON.parse(localStorage.getItem('rsu-save') ?? 'null'); if (stored && stored.version === 1) save = { ...save, ...stored }; } catch { /* Corrupt storage does not block play. */ }
function persist() { try { localStorage.setItem('rsu-save', JSON.stringify(save)); } catch { /* Offline game remains playable without storage. */ } }
app.innerHTML = "<main class=\"shell\"><header class=\"masthead\"><a class=\"brand\" href=\"#\" aria-label=\"RSU\"><span class=\"brand-mark\">R<span>/</span>S</span><span>RUBBER STEEL <b>UNDERGROUND</b></span></a><div class=\"meta\"><span class=\"facility-status\">SECTOR 01 · LOCAL SIMULATION</span><button class=\"quiet\" id=\"sound\">SOUND ON</button><button class=\"quiet\" id=\"pause\">PAUSE Ⅱ</button></div></header><div class=\"arena\"><canvas width=\"1120\" height=\"640\" id=\"game\" aria-label=\"RSU 見下ろし型アクションゲーム\"></canvas><div class=\"ingame-hud\"><div class=\"hud-corner top-left\"><div class=\"overline\">UNDERGROUND / STAGE 01</div><div class=\"floor-display\">FLOOR <strong id=\"floor\">01 / 10</strong></div><div id=\"sector-name\">CALIBRATION BAY</div></div><div class=\"hud-corner top-right\"><span class=\"hud-stat\">ENEMIES <b id=\"enemies\">01</b></span><span class=\"hud-stat rounds-label\">LIVE ROUNDS <b id=\"rounds\">000</b></span><span class=\"exit-status\" id=\"exit\">LOCKED</span></div><div class=\"hud-corner bottom-left\"><div class=\"vital-label\">VITAL / STANDARD</div><div class=\"health\"><span class=\"health-icon\">+</span><span id=\"hp\">◆</span><small>ONE LIFE</small></div></div><div class=\"hud-corner bottom-right\"><div class=\"current-weapon\"><span class=\"overline\">EQUIPPED</span><strong id=\"weapon\">STANDARD</strong></div><div class=\"weapons\"><button class=\"weapon active\" data-weapon=\"standard\" title=\"1 STANDARD\">1<span>STD</span></button><button class=\"weapon \" data-weapon=\"triple\" title=\"2 TRIPLE\">2<span>TRI</span></button><button class=\"weapon \" data-weapon=\"heavy\" title=\"3 HEAVY\">3<span>HVY</span></button></div><div class=\"abilities\" id=\"abilities\"></div></div></div><div class=\"overlay\" id=\"overlay\"></div></div><div class=\"underbar\"><span>WASD / 矢印 <b>移動</b> <i>·</i> MOUSE <b>照準</b> <i>·</i> CLICK <b>射撃</b> <i>·</i> ESC <b>一時停止</b></span><div class=\"legend\"><span><i class=\"own\"></i>自弾 / 永久跳弾</span><span><i class=\"enemy\"></i>敵弾</span><small id=\"perf\">RSU / v0.1.0</small></div></div></main>";
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const renderer = new Renderer(ctx);
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const keys = new Set<string>(); let mouse: Vec = { x: 850, y: 150 }, firing = false;
let audio: AudioContext | undefined; let lastSound = 0;
function sound(kind: string) {
  if (save.muted || !audio) return;
  const now = audio.currentTime; if (kind === 'bounce' && now - lastSound < .035) return; lastSound = now;
  const osc = audio.createOscillator(), gain = audio.createGain();
  const freq: Record<string, number> = { shot: 130, bounce: 950, clang: 420, hit: 200, dead: 65, enemy: 100, open: 660 };
  osc.type = kind === 'open' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(freq[kind] ?? 300, now); osc.frequency.exponentialRampToValueAtTime(40, now + .13);
  gain.gain.setValueAtTime(kind === 'bounce' ? CONFIG.reflectionVolume : .08, now); gain.gain.exponentialRampToValueAtTime(.001, now + .14); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + .15);
}
function enableAudio() { audio ??= new AudioContext(); void audio.resume(); }
game.onSound = kind => { renderer.event(kind, game, mouse); sound(kind); };
function bind(id: string, fn: () => void) { document.getElementById(id)?.addEventListener('click', fn); }
function sync() {
  firing = false;
  overlay.className = `overlay ${game.state}`;
  document.querySelector('.arena')!.classList.toggle('title-mode', game.state === 'title');
  save.bestFloor = Math.max(save.bestFloor, game.floor + 1);
  if (game.state === 'won') save.bestSeconds = save.bestSeconds === null ? game.elapsed : Math.min(save.bestSeconds, game.elapsed);
  persist();
  document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.classList.toggle('active', b.dataset.weapon === game.weapon));
  document.getElementById('abilities')!.innerHTML = game.abilities.map(id => `<span class="ability-badge" title="${ABILITIES.find(a => a.id === id)!.name}">${abilityIcon(id)}</span>`).join('');
  const button = (id: string, text: string, primary = true) => `<button id="${id}" class="${primary ? 'primary' : 'secondary'}">${text}</button>`;
  if (game.state === 'title') overlay.innerHTML = `<div class="title-panel"><div class="eyebrow"><span></span> BALLISTIC RESEARCH DIVISION / 01</div><h1>RUBBER STEEL<br><span>UNDERGROUND</span></h1><div class="title-tagline">撃つほど、逃げ場がなくなる。</div><p>弾は消えない。敵に当たる、その瞬間まで。<br>自分の一発が、次の脅威になる。</p>${button('start', 'START RUN <span>↗</span>')}<div class="run-meta"><span>01 STAGE / 10 FLOORS</span><span>BEST FLOOR ${String(save.bestFloor).padStart(2,'0')}</span></div><div class="title-instructions">敵全滅で出口が開放。残った自弾を避けて進め。</div></div>`;
  else if (game.state === 'dead') overlay.innerHTML = `<div class="panel"><div class="eyebrow">EXPERIMENT TERMINATED / FLOOR ${game.floor + 1}</div><h2>${game.deathCause.startsWith('OWN') ? 'YOUR SHOT.<br><span class="accent">YOUR CONSEQUENCE.</span>' : 'SIGNAL LOST.'}</h2><p>${game.deathCause}<br>死亡弾を白いリングで表示。取得能力は失われました。</p>${button('retry', 'RETRY FLOOR ↻')}${button('title', 'RETURN TO TITLE', false)}</div>`;
  else if (game.state === 'paused') overlay.innerHTML = `<div class="panel"><div class="eyebrow">SIMULATION ON HOLD</div><h2>PAUSED</h2><p>弾も敵も停止しています。</p>${button('resume', 'RESUME →')}${button('title', 'RETURN TO TITLE', false)}</div>`;
  else if (game.state === 'choice') overlay.innerHTML = `<div class="panel choice-panel"><div class="eyebrow">FLOOR ${String(game.floor+1).padStart(2,'0')} COMPLETE</div><h2>次の一発を、考える。</h2><p>能力をひとつ選択 / このRUNのみ有効</p><div class="cards">${game.choices.map(id=>{const a=ABILITIES.find(a=>a.id===id)!;return `<button class="card" data-ability="${id}"><span class="card-icon">${abilityIcon(id)}</span><strong>${a.name}</strong><p>${ABILITY_SUMMARIES[id]}</p><span class="card-select">SELECT MOD <span>↗</span></span></button>`;}).join('')}</div></div>`;
  else if (game.state === 'won') overlay.innerHTML = `<div class="panel"><div class="eyebrow">STAGE 01 / ALL 10 FLOORS COMPLETE</div><h2>YOU MADE IT<br><span class="accent">OUT OF THE LOOP.</span></h2><p>${Math.floor(game.elapsed / 60)}m ${Math.floor(game.elapsed % 60)}s &nbsp; / &nbsp; ${game.shots} SHOTS &nbsp; / &nbsp; ${game.reflectionCount} REFLECTIONS<br>さっき撃った弾は、怖かったですか。</p>${button('start', 'NEW RUN ↻')}${button('title', 'RETURN TO TITLE', false)}</div>`;
  else overlay.innerHTML = '';
  bind('start', () => { enableAudio(); game.start(); }); bind('retry', () => game.retry()); bind('title', () => { game.state = 'title'; sync(); }); bind('resume', togglePause);
  overlay.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach(b => b.onclick = () => game.choose(b.dataset.ability as typeof game.choices[number]));
}
game.onChange = sync;
function togglePause() { if (game.state === 'playing') game.state = 'paused'; else if (game.state === 'paused') game.state = 'playing'; sync(); }
bind('pause', togglePause); bind('sound', () => { save.muted = !save.muted; persist(); updateSound(); });
function updateSound() { document.getElementById('sound')!.textContent = save.muted ? 'SOUND OFF' : 'SOUND ON'; }
document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.onclick = () => game.setWeapon(b.dataset.weapon as Weapon));
window.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); keys.add(e.key.toLowerCase()); if (e.repeat) return; if (e.key === 'Escape') togglePause(); if (['1','2','3'].includes(e.key) && game.state === 'playing') game.setWeapon((['standard','triple','heavy'] as Weapon[])[Number(e.key) - 1]); if (e.key.toLowerCase() === 'r' && game.state === 'dead') game.retry(); });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); firing = false; if (game.state === 'playing') togglePause(); });
canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse = renderer.screenToWorld({ x: (e.clientX - r.left) / r.width * CONFIG.width, y: (e.clientY - r.top) / r.height * CONFIG.height }); });
canvas.addEventListener('pointerdown', e => { if (e.button === 0) { enableAudio(); firing = true; canvas.setPointerCapture(e.pointerId); } });
window.addEventListener('pointerup', () => firing = false); canvas.addEventListener('contextmenu', e => e.preventDefault());
game.loadFloor(); game.state='title'; sync(); updateSound();
let previous=performance.now(),accumulator=0,frames=0,frameTime=0;
function tick(now: number){const delta=Math.min((now-previous)/1000,.08);previous=now;accumulator+=delta;const movement={x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))};while(accumulator>=CONFIG.fixedStep){game.update(CONFIG.fixedStep,movement,mouse,firing);accumulator-=CONFIG.fixedStep;}renderer.draw(game,mouse,delta);document.getElementById('floor')!.textContent=`${String(game.floor+1).padStart(2,'0')} / 10`;document.getElementById('hp')!.textContent=game.player.hp>0?'◆':'◇';document.getElementById('weapon')!.textContent=WEAPONS[game.weapon].name;document.getElementById('enemies')!.textContent=String(game.remaining).padStart(2,'0');document.getElementById('rounds')!.textContent=String(game.bullets.filter(b=>b.owner==='player').length).padStart(3,'0');document.getElementById('exit')!.textContent=game.remaining?'LOCKED':'OPEN';document.getElementById('exit')!.classList.toggle('unlocked',!game.remaining);document.getElementById('sector-name')!.textContent=game.layout.name;frames++;frameTime+=delta;if(frameTime>1){document.getElementById('perf')!.textContent=`${Math.round(frames/frameTime)} FPS / ${game.bullets.length} OF ${CONFIG.maxBullets} ROUNDS`;frames=0;frameTime=0;}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
