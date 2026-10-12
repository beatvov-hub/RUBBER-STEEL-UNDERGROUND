import { ABILITIES, CHARACTERS, CONFIG, WEAPONS, type Ability, type CharacterId, type EnemyType, type Hazard, type Rect, type ReinforcementWave, type Vec, type Weapon } from './data';
import { BOSS_ARCHETYPES, floorFor, STAGES } from './world';
export type Bullet = Vec & { vx: number; vy: number; radius: number; damage: number; active: boolean; owner: 'player' | 'enemy'; reflections: number; age: number; armed: boolean; heavy: boolean; weapon?:Weapon; trail: Vec[] };
export type Enemy = Vec & { type: EnemyType; hp: number; armor: boolean; radius: number; timer: number; hit: number; slow?: number; cluster?: number };
export type Effect = Vec & { age: number; color: string; text?: string };
export type State = 'title' | 'playing' | 'paused' | 'dead' | 'choice' | 'stage-clear' | 'won';
export type HazardState = { source: Hazard; rect: Rect; warning: boolean; active: boolean; progress: number };
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function circleRect(p: Vec, radius: number, r: Rect) {
  return Math.hypot(p.x - Math.max(r.x, Math.min(p.x, r.x + r.w)), p.y - Math.max(r.y, Math.min(p.y, r.y + r.h))) < radius;
}
export class Game {
  state: State = 'title'; stage = 1; floor = 0; character: CharacterId = 'standard'; weapon: Weapon = 'standard'; abilities: Ability[] = [];
  debugInvincible=false;
  player = { x: 0, y: 0, hp: CONFIG.playerHP }; bullets: Bullet[] = []; pool: Bullet[] = []; enemies: Enemy[] = []; effects: Effect[] = [];
  reinforcementQueue:ReinforcementWave[]=[]; reinforcementWarning?:{anchors:Vec[];timeLeft:number}; private reinforcementTimer=0;
  cooldown = 0; elapsed = 0; floorTime = 0; shots = 0; kills = 0; reflectionCount = 0; message = ''; messageTime = 0;
  weaponFires:Record<Weapon,number>={standard:0,triple:0,heavy:0};weaponKills:Record<Weapon,number>={standard:0,triple:0,heavy:0};
  deathCause = ''; fatalBullet?: Bullet; choices: Ability[] = []; onSound: (kind: string) => void = () => {}; onChange: () => void = () => {};
  get layout() { return floorFor(this.stage,this.floor+1); }
  get bossSpec(){return BOSS_ARCHETYPES[STAGES[this.stage-1].area];}
  get entry() { const b = this.layout.bounds; return { x: b.x + 45, y: b.y + b.h - 45 }; }
  get exit() { const b = this.layout.bounds; return { x: b.x + b.w - 45, y: b.y + 45 }; }
  get activeRemaining() { return this.enemies.filter(e => e.hp > 0).length; }
  get remaining() { return this.activeRemaining+this.reinforcementQueue.reduce((total,wave)=>total+wave.types.length,0); }
  get hazards(): HazardState[] { return this.layout.hazards.map(source=>{
    if(source.type==='moving_wall'){
      const start=source.warningSeconds, active=this.floorTime>=start;
      const phase=active?(this.floorTime-start)*Math.PI*2/(source.period??8)+(source.phase??0):0;
      const offset=active?Math.sin(phase)*(source.span??0):0;
      return {source,rect:{...source.rect,x:source.rect.x+(source.axis==='x'?offset:0),y:source.rect.y+(source.axis==='y'?offset:0)},warning:!active,active,progress:active?(Math.sin(phase)+1)/2:this.floorTime/start};
    }
    const collapseAt=source.period??12,warningAt=Math.max(0,collapseAt-source.warningSeconds);
    return {source,rect:source.rect,warning:this.floorTime>=warningAt&&this.floorTime<collapseAt,active:this.floorTime>=collapseAt,progress:Math.max(0,Math.min(1,(this.floorTime-warningAt)/source.warningSeconds))};
  }); }
  get hazardBlockers(){return this.hazards.filter(h=>h.active).map(h=>h.rect);}
  stacks(id: Ability) { return this.abilities.filter(a => a === id).length; }
  start(stage=1,character:CharacterId='standard') { if(!Number.isInteger(stage)||stage<1||stage>50)throw new RangeError('Stage must be 1–50'); if(!CHARACTERS[character])throw new RangeError('Unknown character'); this.stage=stage; this.character=character; this.floor = 0; this.abilities = []; this.weapon = 'standard'; this.elapsed = 0; this.shots = 0; this.kills = 0; this.reflectionCount = 0; this.weaponFires={standard:0,triple:0,heavy:0};this.weaponKills={standard:0,triple:0,heavy:0};this.loadFloor(); }
  loadFloor() {
    for (const b of this.bullets) { b.active = false; this.pool.push(b); } this.bullets = [];
    this.player = { ...this.entry, hp: CHARACTERS[this.character].hp }; this.enemies = this.layout.enemies.map(e => ({ ...e, hp: e.type === 'boss' ? this.bossSpec.hp : e.type==='armored'?2:1, armor: e.type === 'armored'||(e.type==='boss'&&(this.stage===1||this.stage%10===0)), radius: e.type === 'boss' ? 33 : 15, timer: 2.5, hit: 0, slow: 0 }));
    this.reinforcementQueue=(this.layout.reinforcements??[]).map(w=>({types:[...w.types],anchors:w.anchors.map(p=>({...p})),clusterIds:w.clusterIds?[...w.clusterIds]:undefined}));this.reinforcementWarning=undefined;this.reinforcementTimer=0;
    this.effects = []; this.fatalBullet = undefined; this.floorTime=0; this.cooldown = .35; this.state = 'playing'; this.toast(`FLOOR ${String(this.floor + 1).padStart(2, '0')} / ${this.layout.name}`); this.onChange();
  }
  retry() { this.abilities = []; this.weapon = 'standard'; this.loadFloor(); }
  toast(message: string) { this.message = message; this.messageTime = 2.8; }
  private updateReinforcements(dt:number){
    const wave=this.reinforcementQueue[0];
    if(!wave){this.reinforcementWarning=undefined;return;}
    if(this.activeRemaining>4){this.reinforcementWarning=undefined;this.reinforcementTimer=0;return;}
    if(!this.reinforcementWarning){this.reinforcementTimer=2;this.reinforcementWarning={anchors:wave.anchors.map(p=>({...p})),timeLeft:2};this.toast('INCOMING REINFORCEMENTS — 2 SEC');}
    this.reinforcementTimer=Math.max(0,this.reinforcementTimer-dt);
    this.reinforcementWarning.timeLeft=this.reinforcementTimer;
    if(this.reinforcementTimer>0)return;
    const blocked=this.hazards.filter(h=>h.active).map(h=>h.rect),spawned:number[]=[];
    for(let i=0;i<wave.types.length;i++){
      const p=wave.anchors[i];
      if(distance(p,this.player)<100||this.enemies.some(e=>e.hp>0&&distance(e,p)<54)||blocked.some(r=>circleRect(p,26,r)))continue;
      const type=wave.types[i];this.enemies.push({x:p.x,y:p.y,type,hp:type==='armored'?2:1,armor:type==='armored',radius:15,timer:2.5,hit:0,slow:0,cluster:wave.clusterIds?.[i]??undefined});spawned.push(i);
    }
    if(spawned.length){
      const spawnedSet=new Set(spawned),types=wave.types.filter((_,i)=>!spawnedSet.has(i)),anchors=wave.anchors.filter((_,i)=>!spawnedSet.has(i)),clusterIds=wave.clusterIds?.filter((_,i)=>!spawnedSet.has(i));
      if(types.length){this.reinforcementQueue[0]={types,anchors,clusterIds};this.reinforcementTimer=1.25;this.reinforcementWarning={anchors:anchors.map(p=>({...p})),timeLeft:1.25};this.toast('REINFORCEMENTS DEPLOYED — CLEAR THE SIGNALS');}
      else{this.reinforcementQueue.shift();this.reinforcementTimer=0;this.reinforcementWarning=undefined;}
      this.onChange();
    }else{
      this.reinforcementTimer=.75;this.reinforcementWarning={anchors:wave.anchors.map(p=>({...p})),timeLeft:.75};
      this.toast('MOVE CLEAR OF REINFORCEMENT SIGNALS');
    }
  }
  setWeapon(weapon: Weapon) { this.weapon = weapon; this.onChange(); }
  addBullet(x: number, y: number, angle: number, owner: 'player' | 'enemy', heavy = false) {
    if (this.bullets.length >= CONFIG.maxBullets) return;
    const w = WEAPONS[heavy ? 'heavy' : this.weapon];
    const speed = owner === 'enemy' ? 170 : w.speed * Math.pow(.85, this.stacks('slow'));
    const b = this.pool.pop() ?? {} as Bullet;
    Object.assign(b, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: owner === 'enemy' ? 5 : w.radius + (heavy ? 2 * this.stacks('mass') : 0), damage: owner === 'enemy' ? 1 : w.damage + (heavy ? 2 * this.stacks('power') : 0), active: true, owner, reflections: 0, age: 0, armed: owner === 'enemy', heavy, weapon:owner==='enemy'?undefined:heavy?'heavy':this.weapon, trail: [] });
    this.bullets.push(b); return b;
  }
  shoot(target: Vec) {
    if (this.state !== 'playing' || this.cooldown > 0) return;
    const w = WEAPONS[this.weapon];
    if (this.bullets.length + w.angles.length > CONFIG.maxBullets) { this.toast('BULLET LIMIT — 敵に当てて弾を回収'); return; }
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    // Keep the muzzle out of steel even when firing directly beside a wall.
    for (const baseOffset of w.angles) {
      const offset = this.weapon === 'triple' ? baseOffset * (1 + .37 * this.stacks('spread')) : baseOffset;
      let muzzle = 22; const bounds = this.layout.bounds;
      while (muzzle > 0) {
        const point = { x: this.player.x + Math.cos(angle + offset) * muzzle, y: this.player.y + Math.sin(angle + offset) * muzzle };
        if (point.x >= bounds.x + w.radius && point.x <= bounds.x + bounds.w - w.radius && point.y >= bounds.y + w.radius && point.y <= bounds.y + bounds.h - w.radius && !this.layout.walls.some(r => circleRect(point, w.radius, r))) break;
        muzzle -= 1;
      }
      this.addBullet(this.player.x + Math.cos(angle + offset) * muzzle, this.player.y + Math.sin(angle + offset) * muzzle, angle + offset, 'player', this.weapon === 'heavy');
    }
    this.cooldown = w.cooldown * Math.pow(.9,this.stacks('trigger')) * (this.weapon==='triple'?Math.pow(.85,this.stacks('salvo')):1); this.shots += w.angles.length;this.weaponFires[this.weapon]++; this.onSound(this.weapon==='heavy'?'heavy':this.weapon==='triple'?'triple':'shot');
  }
  moveCircle(p: Vec, dx: number, dy: number, radius: number) {
    const b = this.layout.bounds;
    const oldX = p.x; p.x = Math.max(b.x + radius, Math.min(b.x + b.w - radius, p.x + dx));
    if ([...this.layout.walls,...this.hazardBlockers].some(w => circleRect(p, radius, w))) p.x = oldX;
    const oldY = p.y; p.y = Math.max(b.y + radius, Math.min(b.y + b.h - radius, p.y + dy));
    if ([...this.layout.walls,...this.hazardBlockers].some(w => circleRect(p, radius, w))) p.y = oldY;
  }
  reflect(b: Bullet, axis: 'x' | 'y') {
    if (axis === 'x') b.vx *= -1; else b.vy *= -1;
    if (b.owner === 'player' && b.reflections === 0) { const factor=Math.pow(.9,this.stacks('coolant')); b.vx*=factor; b.vy*=factor; }
    b.reflections++; b.armed = true; this.reflectionCount++;
    this.effects.push({ x: b.x, y: b.y, age: .2, color: '#e7fa9e' }); this.onSound('bounce');
  }
  update(dt: number, movement: Vec = { x: 0, y: 0 }, target?: Vec, firing = false) {
    if (this.state !== 'playing') return;
    this.elapsed += dt; this.floorTime += dt; this.cooldown -= dt; this.messageTime -= dt;
    for(const h of this.hazards)if(h.active&&circleRect(this.player,CONFIG.playerRadius,h.rect)){this.die(h.source.type==='collapse'?'FLOOR COLLAPSE / 床の崩落':'MOVING STEEL / 可動壁への接触');break;}
    if(this.state!=='playing')return;
    const norm = Math.max(1, Math.hypot(movement.x, movement.y));
    const speed = CHARACTERS[this.character].speed * (1 + .15 * this.stacks('move')) * (1 + .1 * this.stacks('stride')) * (firing?1+.12*this.stacks('strafe'):1) * (!this.remaining?1+.2*this.stacks('exit'):1);
    this.moveCircle(this.player, movement.x / norm * speed * dt, movement.y / norm * speed * dt, CONFIG.playerRadius);
    if (firing && target) this.shoot(target);
    for (let enemyIndex=0;enemyIndex<this.enemies.length;enemyIndex++) {
      const e=this.enemies[enemyIndex];
      if (e.hp <= 0) continue; e.timer -= dt; e.hit = Math.max(0, e.hit - dt); e.slow=Math.max(0,(e.slow??0)-dt);
      const d = distance(e, this.player), a = Math.atan2(this.player.y - e.y, this.player.x - e.x), area=STAGES[this.stage-1].area;
      let moveX=0,moveY=0;
      if(e.type==='shooter'){
        // Shooters hold a readable mid-range orbit instead of standing still inside it.
        const radial=d>350?40+area*2:d<215?-(28+area*2):Math.max(-14,Math.min(14,(d-280)*.2));
        const orbit=d<215?14+area: d<=350?(24+area*2)*(Math.sin(this.elapsed*.65+(e.x+e.y)*.003)<0?-1:1):0;
        moveX=Math.cos(a)*radial+Math.cos(a+Math.PI/2)*orbit;
        moveY=Math.sin(a)*radial+Math.sin(a+Math.PI/2)*orbit;
      }else{
        const speed=e.type==='boss'?this.bossSpec.speed:e.type==='armored'?38+area*4:50+area*4;
        moveX=Math.cos(a)*speed;moveY=Math.sin(a)*speed;
      }
      // Preserve readable silhouettes when pursuers converge on the same route.
      let separationX=0,separationY=0;
      for(let otherIndex=0;otherIndex<this.enemies.length;otherIndex++){
        if(otherIndex===enemyIndex)continue;const other=this.enemies[otherIndex];if(other.hp<=0)continue;
        let dx=e.x-other.x,dy=e.y-other.y,d=Math.hypot(dx,dy),minimum=e.radius+other.radius+8;
        if(d>=minimum)continue;
        if(d<.001){const angle=(enemyIndex-otherIndex)*2.399963229728653;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
        const strength=(minimum-d)/minimum;separationX+=dx/d*strength;separationY+=dy/d*strength;
      }
      const separationLength=Math.hypot(separationX,separationY);if(separationLength>1){separationX/=separationLength;separationY/=separationLength;}
      moveX+=separationX*90;moveY+=separationY*90;
      // Axis steering lets pursuers round corners without teleporting through steel.
      const before = { x: e.x, y: e.y };
      const slow=e.slow>0?.55:1;moveX*=slow;moveY*=slow;
      this.moveCircle(e,moveX*dt,moveY*dt,e.radius);
      if ((moveX||moveY) && distance(before, e) < .01) this.moveCircle(e,-moveY*dt,moveX*dt,e.radius);
      if ((e.type === 'shooter' || e.type === 'boss') && e.timer <= 0) {
        e.timer = e.type === 'boss' ? this.bossSpec.cooldown : 3.5-area*.13;
        const count=e.type==='boss'?(this.stage===1?1:this.stage%10===0?this.bossSpec.shots:2):1;
        for(let shot=0;shot<count;shot++){const angle=a+(shot-(count-1)/2)*.17;this.addBullet(e.x + Math.cos(angle) * (e.radius + 7), e.y + Math.sin(angle) * (e.radius + 7), angle, 'enemy');} this.onSound('enemy');
      }
      if (d < CONFIG.playerRadius + e.radius) this.die('CONTACT / 敵との接触');
    }
    const bulletWalls=[...this.layout.walls,...this.hazards.filter(h=>h.active&&h.source.type==='moving_wall').map(h=>h.rect)];
    for (const b of this.bullets) {
      if (!b.active) continue; b.age += dt;
      if (b.owner === 'player' && distance(b, this.player) > CONFIG.playerRadius + b.radius + 6) b.armed = true;
      if (b.owner === 'enemy' && b.age > CONFIG.enemyBulletLifetime) { b.active = false; continue; }
      if (b.owner === 'player' && this.stacks('magnet')) {
        const e = this.enemies.find(e => e.hp > 0 && distance(e, b) < 100);
        if (e) { const speed = Math.hypot(b.vx, b.vy); const a = Math.atan2(e.y - b.y, e.x - b.x); const turn = Math.min(.03, dt * .75 * this.stacks('magnet')); b.vx += (Math.cos(a) * speed - b.vx) * turn; b.vy += (Math.sin(a) * speed - b.vy) * turn; const newSpeed = Math.hypot(b.vx, b.vy); b.vx *= speed / newSpeed; b.vy *= speed / newSpeed; }
      }
      // Small swept substeps prevent tunneling, even with heavy bullets and corner rebounds.
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / Math.min(b.radius, 4)));
      for (let n = 0; n < steps && b.active; n++) {
        const bounds = this.layout.bounds; const oldX = b.x, oldY = b.y;
        b.x += b.vx * dt / steps;
        let collide = b.x < bounds.x + b.radius || b.x > bounds.x + bounds.w - b.radius || bulletWalls.some(w => circleRect(b, b.radius, w));
        if (collide) { b.x = Math.max(bounds.x + b.radius, Math.min(bounds.x + bounds.w - b.radius, oldX)); if (b.owner === 'enemy') b.active = false; else this.reflect(b, 'x'); }
        if (!b.active) break;
        b.y += b.vy * dt / steps;
        collide = b.y < bounds.y + b.radius || b.y > bounds.y + bounds.h - b.radius || bulletWalls.some(w => circleRect(b, b.radius, w));
        if (collide) { b.y = Math.max(bounds.y + b.radius, Math.min(bounds.y + bounds.h - b.radius, oldY)); if (b.owner === 'enemy') b.active = false; else this.reflect(b, 'y'); }
        if (!b.active) break;
        if (b.owner === 'player') for (const e of this.enemies) {
          const hitScale=1+.2*this.stacks('target')+(b.age<1?.1*this.stacks('pilot'):0)+(e.armor?.15*this.stacks('breach'):0);
          if (e.hp <= 0 || distance(b, e) > b.radius + e.radius * hitScale) continue;
          e.hit = .18;
          if (e.armor) {
            e.armor = false; const len = Math.max(.01, distance(b, e)); const nx = (b.x - e.x) / len, ny = (b.y - e.y) / len; const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            const slow = Math.pow(.75, this.stacks('armor'))*Math.pow(.9,this.stacks('control')); b.vx *= slow; b.vy *= slow;
            const radius = e.radius * hitScale + b.radius + 1;
            b.x = e.x + nx * radius; b.y = e.y + ny * radius; b.armed = true; b.reflections++; this.reflectionCount++;
            this.effects.push({ x: e.x, y: e.y, age: .65, color: '#77d8ea', text: 'ARMOR BREAK' }); this.onSound('clang');
          } else {
            b.active = false; e.hp -= b.damage + (e.type==='boss'&&b.reflections===0?this.stacks('boss'):0); this.onSound('hit'); this.effects.push({ x: e.x, y: e.y, age: .35, color: '#ff8b73' });
            if(this.character==='fire')for(const other of this.enemies)if(other!==e&&other.hp>0&&!other.armor&&distance(other,e)<66){other.hp-=1;other.hit=.4;this.effects.push({x:other.x,y:other.y,age:.35,color:'#ff9975'});if(other.hp<=0){this.kills++;this.weaponKills[b.weapon??this.weapon]++;}}
            if(this.character==='ice')for(const other of this.enemies)if(other.hp>0&&distance(other,e)<100)other.slow=Math.max(other.slow??0,1.5);
            if(this.character==='thunder'){const other=this.enemies.find(other=>other!==e&&other.hp>0&&!other.armor&&distance(other,e)<135);if(other){other.hp-=1;other.hit=.4;this.effects.push({x:other.x,y:other.y,age:.35,color:'#e9d48e'});if(other.hp<=0){this.kills++;this.weaponKills[b.weapon??this.weapon]++;}}}
            if (e.hp <= 0) { this.kills++;this.weaponKills[b.weapon??this.weapon]++; if (!this.remaining) { this.toast('EXIT OPEN — 残った自弾に注意'); this.onSound('open'); this.onChange(); } }
          }
          break;
        }
        if (b.active && b.armed && distance(b, this.player) < b.radius + CONFIG.playerRadius) { this.die(b.owner === 'player' ? 'OWN BULLET / 自分の跳弾' : 'ENEMY FIRE / 敵の弾', b); break; }
      }
      if (b.trail.length > 7) b.trail.shift(); b.trail.push({ x: b.x, y: b.y });
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) if (!this.bullets[i].active) { this.pool.push(this.bullets[i]); this.bullets.splice(i, 1); }
    this.updateReinforcements(dt);
    this.effects = this.effects.filter(e => (e.age -= dt) > 0);
    if (this.state === 'playing' && !this.remaining && distance(this.player, this.exit) < 26) this.advance();
  }
  die(cause: string, bullet?: Bullet) {
    if (this.state !== 'playing') return;
    if(this.debugInvincible)return;
    this.player.hp--; this.onSound('damage'); if (this.player.hp > 0) return;
    this.state = 'dead'; this.deathCause = cause; this.fatalBullet = bullet; this.abilities = []; this.onSound('gameover'); this.onChange();
  }
  advance() {
    if (this.floor === 9) { this.state = this.stage===50?'won':'stage-clear'; this.onChange(); return; }
    this.onSound('floor-clear');
    if (CONFIG.abilityFloors.includes(this.floor + 1)) {
      this.choices = [...ABILITIES].sort(() => Math.random() - .5).slice(0, 3).map(a => a.id); this.state = 'choice'; this.onChange();
    } else { this.floor++; this.loadFloor(); }
  }
  choose(id: Ability) { if (this.state !== 'choice' || !this.choices.includes(id)) return; this.abilities.push(id); this.onSound('ability'); this.floor++; this.loadFloor(); }
}
