import { ABILITIES, CHARACTERS, CONFIG, WEAPONS, type Ability, type CharacterId, type EnemyType, type Hazard, type Rect, type ReinforcementWave, type Vec, type Weapon } from './data';
import { BOSS_ARCHETYPES, floorFor, REINFORCEMENT_TRIGGER_REMAINING, STAGES } from './world';
import { enemyDefinition } from './enemies/definitions';
import type { EnemyBehaviorState } from './enemies/state';
import { movementIntent } from './enemies/behaviors/movement';
import { applyEnemyBulletFields, updateOrbiterRound } from './enemies/fields';
export type Bullet = Vec & { vx: number; vy: number; radius: number; damage: number; active: boolean; owner: 'player' | 'enemy'; reflections: number; age: number; armed: boolean; heavy: boolean; weapon?:Weapon; trail: Vec[]; split?:boolean; source?:EnemyType; orbitTime?:number; fieldHits?:EnemyType[] };
export type Enemy = Vec & { type: EnemyType; hp: number; armor: boolean; radius: number; timer: number; hit: number; slow?: number; cluster?: number; squad?:number; behavior?:EnemyBehaviorState };
export type Effect = Vec & { age: number; color: string; text?: string };
export type State = 'title' | 'playing' | 'paused' | 'dead' | 'choice' | 'stage-clear' | 'won';
export type HazardState = { source: Hazard; rect: Rect; warning: boolean; active: boolean; progress: number };
export type EnemyField={rect:Rect;life:number;owner:number;kind?:'wall'|'shutter'|'mine';arm?:number};
export type AttackWarning={x:number;y:number;radius:number;life:number;kind:string;owner:number;angle?:number};
export type EnemyDecoy={x:number;y:number;life:number;owner:number;side:number};
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
function makeEnemy(spawn:Vec&{type:EnemyType;cluster?:number;squad?:number},bossHp=8) { const definition=enemyDefinition(spawn.type);return {...spawn,hp:spawn.type==='boss'?bossHp:definition.hp,armor:['armored','boss'].includes(spawn.type),radius:definition.radius,timer:2.5,hit:0,slow:0,behavior:{}} as Enemy; }
export function circleRect(p: Vec, radius: number, r: Rect) {
  return Math.hypot(p.x - Math.max(r.x, Math.min(p.x, r.x + r.w)), p.y - Math.max(r.y, Math.min(p.y, r.y + r.h))) < radius;
}
export class Game {
  state: State = 'title'; stage = 1; floor = 0; character: CharacterId = 'standard'; weapon: Weapon = 'standard'; abilities: Ability[] = [];
  debugInvincible=false;
  player = { x: 0, y: 0, hp: CONFIG.playerHP }; bullets: Bullet[] = []; pool: Bullet[] = []; enemies: Enemy[] = []; effects: Effect[] = [];
  private playerTrail:{x:number;y:number;t:number}[]=[];
  enemyFields:EnemyField[]=[];
  attackWarnings:AttackWarning[]=[];
  enemyDecoys:EnemyDecoy[]=[];
  private beaconWaveTriggered=false;
  reinforcementQueue:ReinforcementWave[]=[]; reinforcementWarning?:{anchors:Vec[];timeLeft:number}; private reinforcementTimer=0;
  cooldown = 0; elapsed = 0; floorTime = 0; shots = 0; kills = 0; reflectionCount = 0; message = ''; messageTime = 0;
  weaponFires:Record<Weapon,number>={standard:0,triple:0,heavy:0};weaponKills:Record<Weapon,number>={standard:0,triple:0,heavy:0};weaponReflections:Record<Weapon,number>={standard:0,triple:0,heavy:0};
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
  start(stage=1,character:CharacterId='standard') { if(!Number.isInteger(stage)||stage<1||stage>50)throw new RangeError('Stage must be 1–50'); if(!CHARACTERS[character])throw new RangeError('Unknown character'); this.stage=stage; this.character=character; this.floor = 0; this.abilities = []; this.weapon = 'standard'; this.elapsed = 0; this.shots = 0; this.kills = 0; this.reflectionCount = 0; this.weaponFires={standard:0,triple:0,heavy:0};this.weaponKills={standard:0,triple:0,heavy:0};this.weaponReflections={standard:0,triple:0,heavy:0};this.loadFloor(); }
  loadFloor() {
    for (const b of this.bullets) { b.active = false; this.pool.push(b); } this.bullets = [];
    this.player = { ...this.entry, hp: CHARACTERS[this.character].hp }; this.enemies = this.layout.enemies.map(e => {const enemy=makeEnemy(e,this.bossSpec.hp);if(enemy.type==='boss')enemy.armor=this.stage===1||this.stage%10===0;return enemy;});
    this.reinforcementQueue=(this.layout.reinforcements??[]).map(w=>({types:[...w.types],anchors:w.anchors.map(p=>({...p})),clusterIds:w.clusterIds?[...w.clusterIds]:undefined,squadIds:w.squadIds?[...w.squadIds]:undefined}));this.reinforcementWarning=undefined;this.reinforcementTimer=0;
    this.effects = []; this.enemyFields=[];this.attackWarnings=[];this.enemyDecoys=[];this.playerTrail=[];this.beaconWaveTriggered=false;this.fatalBullet = undefined; this.floorTime=0; this.cooldown = .35; this.state = 'playing'; this.toast(`FLOOR ${String(this.floor + 1).padStart(2, '0')} / ${this.layout.name}`); this.onChange();
  }
  retry() { this.abilities = []; this.weapon = 'standard'; this.loadFloor(); }
  toast(message: string) { this.message = message; this.messageTime = 2.8; }
  private updateReinforcements(dt:number){
    const wave=this.reinforcementQueue[0];
    if(!wave){this.reinforcementWarning=undefined;return;}
    const beacon=this.enemies.some(enemy=>enemy.hp>0&&enemy.type==='reinforcement_beacon'&&!enemy.behavior?.used),threshold=beacon||this.beaconWaveTriggered?Math.min(8,REINFORCEMENT_TRIGGER_REMAINING+3):REINFORCEMENT_TRIGGER_REMAINING;
    if(this.activeRemaining>threshold){this.reinforcementWarning=undefined;this.reinforcementTimer=0;return;}
    if(!this.reinforcementWarning){this.reinforcementTimer=2;this.reinforcementWarning={anchors:wave.anchors.map(p=>({...p})),timeLeft:2};this.toast('INCOMING REINFORCEMENTS — 2 SEC');if(beacon){this.beaconWaveTriggered=true;const source=this.enemies.find(enemy=>enemy.type==='reinforcement_beacon'&&enemy.hp>0);if(source&&!source.behavior!.alerted){source.behavior!.alerted=true;this.toast('BEACON SIGNAL — REINFORCEMENTS INBOUND');}}}
    this.reinforcementTimer=Math.max(0,this.reinforcementTimer-dt);
    this.reinforcementWarning.timeLeft=this.reinforcementTimer;
    if(this.reinforcementTimer>0)return;
    const blocked=this.hazards.filter(h=>h.active).map(h=>h.rect),spawned:number[]=[];
    for(let i=0;i<wave.types.length;i++){
      const p=wave.anchors[i];
      if(distance(p,this.player)<100||this.enemies.some(e=>e.hp>0&&distance(e,p)<54)||blocked.some(r=>circleRect(p,26,r)))continue;
      const type=wave.types[i];this.enemies.push(makeEnemy({x:p.x,y:p.y,type,cluster:wave.clusterIds?.[i]??undefined,squad:wave.squadIds?.[i]??undefined},this.bossSpec.hp));spawned.push(i);
    }
    if(spawned.length){
      const spawnedSet=new Set(spawned),types=wave.types.filter((_,i)=>!spawnedSet.has(i)),anchors=wave.anchors.filter((_,i)=>!spawnedSet.has(i)),clusterIds=wave.clusterIds?.filter((_,i)=>!spawnedSet.has(i)),squadIds=wave.squadIds?.filter((_,i)=>!spawnedSet.has(i));
      if(types.length){this.reinforcementQueue[0]={types,anchors,clusterIds,squadIds};this.reinforcementTimer=1.25;this.reinforcementWarning={anchors:anchors.map(p=>({...p})),timeLeft:1.25};this.toast('REINFORCEMENTS DEPLOYED — CLEAR THE SIGNALS');}
      else{this.reinforcementQueue.shift();this.reinforcementTimer=0;this.reinforcementWarning=undefined;if(this.beaconWaveTriggered){this.beaconWaveTriggered=false;for(const beacon of this.enemies)if(beacon.type==='reinforcement_beacon'&&beacon.hp>0)beacon.behavior!.used=true;}}
      this.onChange();
    }else{
      this.reinforcementTimer=.75;this.reinforcementWarning={anchors:wave.anchors.map(p=>({...p})),timeLeft:.75};
      this.toast('MOVE CLEAR OF REINFORCEMENT SIGNALS');
    }
  }
  setWeapon(weapon: Weapon) { this.weapon = weapon; this.onChange(); }
  addBullet(x: number, y: number, angle: number, owner: 'player' | 'enemy', heavy = false) {
    if (this.bullets.length >= CONFIG.maxBullets) return;
    if(owner==='enemy'&&this.bullets.filter(b=>b.active&&b.owner==='enemy').length>=32)return;
    const w = WEAPONS[heavy ? 'heavy' : this.weapon];
    const speed = owner === 'enemy' ? 170 : w.speed * Math.pow(.85, this.stacks('slow'));
    const b = this.pool.pop() ?? {} as Bullet;
    Object.assign(b, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: owner === 'enemy' ? 5 : w.radius + (heavy ? 2 * this.stacks('mass') : 0), damage: owner === 'enemy' ? 1 : w.damage + (heavy ? 2 * this.stacks('power') : 0), active: true, owner, reflections: 0, age: 0, armed: owner === 'enemy', heavy, weapon:owner==='enemy'?undefined:heavy?'heavy':this.weapon, trail: [],split:undefined,source:undefined,orbitTime:undefined,fieldHits:undefined });
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
    for(const enemy of this.enemies)if(enemy.hp>0&&enemy.type==='trigger_hound')enemy.behavior!.triggerBoost=Math.min(2.6,Math.max(enemy.behavior!.triggerBoost??0,.9)+.55);
  }
  private onEnemyKilled(enemy:Enemy,weapon:Weapon){this.kills++;this.weaponKills[weapon]++;if(enemy.type==='pack_runner'&&enemy.squad!==undefined)for(const mate of this.enemies)if(mate!==enemy&&mate.hp>0&&mate.squad===enemy.squad)mate.behavior!.packBoost=2.2;if(enemy.type==='splitter'&&!enemy.behavior?.used&&this.activeRemaining<10){enemy.behavior!.used=true;for(const side of[-1,1])this.enemies.push({...makeEnemy({x:enemy.x+side*26,y:enemy.y+20,type:'dasher'}),radius:9,hp:1});}if(!this.remaining){this.toast('EXIT OPEN — 残った自弾に注意');this.onSound('open');this.onChange();}}
  moveCircle(p: Vec, dx: number, dy: number, radius: number, ignoreWalls=false) {
    const b = this.layout.bounds;
    const oldX = p.x; p.x = Math.max(b.x + radius, Math.min(b.x + b.w - radius, p.x + dx));
    if ([...(ignoreWalls?[]:this.layout.walls),...this.hazardBlockers,...this.enemyFields.filter(field=>field.kind!=='mine').map(field=>field.rect)].some(w => circleRect(p, radius, w))) p.x = oldX;
    const oldY = p.y; p.y = Math.max(b.y + radius, Math.min(b.y + b.h - radius, p.y + dy));
    if ([...(ignoreWalls?[]:this.layout.walls),...this.hazardBlockers,...this.enemyFields.filter(field=>field.kind!=='mine').map(field=>field.rect)].some(w => circleRect(p, radius, w))) p.y = oldY;
  }
  reflect(b: Bullet, axis: 'x' | 'y') {
    if (axis === 'x') b.vx *= -1; else b.vy *= -1;
    if (b.owner === 'player' && b.reflections === 0) { const factor=Math.pow(.9,this.stacks('coolant')); b.vx*=factor; b.vy*=factor; }
    b.reflections++; b.armed = true;if(b.owner==='player'){this.reflectionCount++;this.weaponReflections[b.weapon??(b.heavy?'heavy':this.weapon)]++;}
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
    this.playerTrail.push({x:this.player.x,y:this.player.y,t:this.floorTime});while(this.playerTrail.length&&this.floorTime-this.playerTrail[0].t>4)this.playerTrail.shift();
    if (firing && target) this.shoot(target);
    for (let enemyIndex=0;enemyIndex<this.enemies.length;enemyIndex++) {
      const e=this.enemies[enemyIndex];
      if (e.hp <= 0) continue; e.timer -= dt; e.hit = Math.max(0, e.hit - dt); e.slow=Math.max(0,(e.slow??0)-dt);
      const d = distance(e, this.player), a = Math.atan2(this.player.y - e.y, this.player.x - e.x), area=STAGES[this.stage-1].area;
      const walls=[...this.layout.walls,...this.hazardBlockers];
      const intent=movementIntent(e,{player:this.player,enemies:this.enemies,elapsed:this.elapsed,dt,area,bossSpeed:this.bossSpec.speed,walls,isFree:(p,r)=>{const b=this.layout.bounds;return p.x>=b.x+r&&p.y>=b.y+r&&p.x<=b.x+b.w-r&&p.y<=b.y+b.h-r&&!walls.some(w=>circleRect(p,r,w));},playerHistory:seconds=>this.playerTrail.find(p=>this.floorTime-p.t>=seconds)});
      if(e.type==='hopper'&&e.behavior!.mode==='windup'&&e.behavior!.landing&&!e.behavior!.alerted){const landing=e.behavior!.landing;this.attackWarnings.push({x:landing.x,y:landing.y,radius:48,life:.98,kind:'HOPPER',owner:enemyIndex});e.behavior!.alerted=true;}
      let moveX=intent.velocity.x,moveY=intent.velocity.y;
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
      this.moveCircle(e,moveX*dt,moveY*dt,e.radius,intent.ignoreWalls===true);
      if ((moveX||moveY) && distance(before, e) < .01&&!(e.type==='dasher'&&e.behavior?.mode==='dash')) this.moveCircle(e,-moveY*dt,moveX*dt,e.radius);
      if(e.type==='dasher'&&e.behavior?.mode==='dash'&&Math.hypot(moveX,moveY)>1&&distance(before,e)<Math.hypot(moveX,moveY)*dt*.55){e.behavior.mode='recover';e.behavior.modeTime=.6;}
      if(e.type==='squad_commander'&&e.behavior!.lastAction!==undefined&&this.elapsed-e.behavior!.lastAction<.8)for(const ally of this.enemies)if(ally!==e&&ally.hp>0&&distance(ally,e)<220){ally.behavior??={};ally.behavior.packBoost=Math.max(ally.behavior.packBoost??0,1.1);}
      if(e.type==='repair_bot'&&e.timer<=0){const target=this.enemies.filter(other=>other!==e&&other.hp>0&&other.type==='armored'&&!other.armor&&distance(e,other)<145).sort((x,y)=>distance(e,x)-distance(e,y))[0];if(target){target.armor=true;e.behavior!.targetEnemyId=this.enemies.indexOf(target);this.effects.push({x:e.x,y:e.y,age:.6,color:'#8be1cb',text:'REPAIR'});}e.timer=6.5;}
      if(e.type==='hunker'&&e.timer<=0){this.attackWarnings.push({x:e.x,y:e.y,radius:115,life:.82,kind:'HUNKER SLAM',owner:enemyIndex});e.timer=5.8;e.behavior!.mode='windup';e.behavior!.modeTime=.82;}
      if(e.type==='reinforcement_beacon'&&!e.behavior!.used&&!e.behavior!.alerted&&this.reinforcementQueue.length&&this.activeRemaining<=8){this.reinforcementTimer=0;this.toast('BEACON SIGNAL — REINFORCEMENTS INBOUND');}
      if(e.type==='wall_builder'&&e.timer<=.4&&!e.behavior!.used){const dx=this.player.x-e.x,dy=this.player.y-e.y,len=Math.max(1,Math.hypot(dx,dy)),cx=e.x+dx/len*115,cy=e.y+dy/len*115,rect={x:cx-5,y:cy-58,w:10,h:116},occupied=this.enemies.some(other=>other!==e&&other.hp>0&&circleRect(other,other.radius+4,rect));if(!this.layout.walls.some(w=>circleRect({x:cx,y:cy},18,w))&&!circleRect(this.player,32,rect)&&!occupied&&!circleRect(this.entry,24,rect)&&!circleRect(this.exit,24,rect)&&distance(e,{x:cx,y:cy})>45)this.enemyFields.push({rect,life:5,owner:enemyIndex,kind:'wall'});e.timer=9;}
      if(e.type==='shutter_operator'&&e.timer<=.4){const angle=Math.atan2(this.player.y-e.y,this.player.x-e.x),cx=e.x-Math.sin(angle)*94,cy=e.y+Math.cos(angle)*94,rect={x:cx-5,y:cy-60,w:10,h:120},occupied=this.enemies.some(other=>other!==e&&other.hp>0&&circleRect(other,other.radius+4,rect));if(this.enemyFields.every(w=>w.owner!==enemyIndex)&&!occupied&&!circleRect(this.player,30,rect)&&!circleRect(this.entry,24,rect)&&!circleRect(this.exit,24,rect)){this.enemyFields.push({rect,life:2.8,owner:enemyIndex,kind:'shutter'});this.effects.push({x:cx,y:cy,age:.5,color:'#efbd78',text:'SHUTTER'});}e.timer=5.5;}
      if(e.type==='mine_layer'&&e.timer<=0&&this.enemyFields.filter(field=>field.owner===enemyIndex&&field.kind==='mine').length<3){const rect={x:this.player.x-12,y:this.player.y-12,w:24,h:24};if(distance(this.player,e)>115&&distance(this.entry,this.player)>120&&!this.layout.walls.some(w=>circleRect(this.player,35,w)))this.enemyFields.push({rect,life:8,arm:1,owner:enemyIndex,kind:'mine'});e.timer=5;}
      if(e.type==='decoy_projector'&&e.timer<=0){this.enemyDecoys=this.enemyDecoys.filter(decoy=>decoy.owner!==enemyIndex);for(const side of[-1,1])this.enemyDecoys.push({x:e.x+side*38,y:e.y-22,life:8,owner:enemyIndex,side});e.timer=9;}
      if(e.type==='mortar'&&e.timer<=0){const dx=this.player.x-e.x,dy=this.player.y-e.y,len=Math.max(1,Math.hypot(dx,dy)),x=this.player.x+dx/len*45,y=this.player.y+dy/len*45;this.attackWarnings.push({x,y,radius:64,life:1.15,kind:'MORTAR',owner:enemyIndex});e.timer=5.8;}
      if(e.type==='shockwaver'){e.behavior!.modeTime=(e.behavior!.modeTime??0)-dt;if(e.timer<=0&&e.behavior!.mode!=='windup'){const gap=a+.65;e.behavior!.mode='windup';e.behavior!.modeTime=1.15;this.attackWarnings.push({x:e.x,y:e.y,radius:112,life:1.15,kind:'SHOCKWAVE',owner:enemyIndex,angle:gap});this.effects.push({x:e.x,y:e.y,age:1.15,color:'#efd28b',text:'SHOCKWAVE'});e.timer=5.5;}if(e.behavior!.mode==='windup'&&e.behavior!.modeTime<=0)e.behavior!.mode='approach';}
      if(e.type==='tracking_sniper'&&e.behavior!.mode==='aim'){const warning=this.attackWarnings.find(item=>item.kind==='SNIPER'&&item.owner===enemyIndex);if(warning&&warning.life>.45){warning.x=e.x;warning.y=e.y;warning.angle=a;e.behavior!.heading={x:Math.cos(a),y:Math.sin(a)};}else e.behavior!.mode='cooldown';}
      if((e.type==='burst_gunner'||e.type==='triple_gunner')&&e.behavior!.mode==='aim'){const warning=this.attackWarnings.find(item=>item.owner===enemyIndex&&(item.kind==='BURST'||item.kind==='TRIPLE_GUNNER'));if(warning&&warning.life>.28){warning.x=e.x;warning.y=e.y;warning.angle=a;}else e.behavior!.mode='cooldown';}
      if(e.type==='burst_gunner'&&e.behavior!.mode==='burst'&&(e.behavior!.shotsLeft??0)>0){e.behavior!.modeTime=(e.behavior!.modeTime??0)-dt;if(e.behavior!.modeTime<=0){const shot=5-(e.behavior!.shotsLeft??0),angle=a+(shot-2)*.055,bullet=this.addBullet(e.x+Math.cos(angle)*(e.radius+7),e.y+Math.sin(angle)*(e.radius+7),angle,'enemy');if(bullet)bullet.source='burst_gunner';e.behavior!.shotsLeft!--;e.behavior!.modeTime=.14;if(!e.behavior!.shotsLeft)e.behavior!.mode='cooldown';}}
      if (['shooter','boss','burst_gunner','tracking_sniper','arc_launcher','triple_gunner','ricochet_gunner'].includes(e.type) && e.timer <= 0) {
        const cooldown=e.type==='boss'?this.bossSpec.cooldown:e.type==='burst_gunner'?4.6:e.type==='tracking_sniper'?4.8:e.type==='triple_gunner'?3.8:e.type==='ricochet_gunner'?4.3:3.5-area*.13;
        e.timer=cooldown;
        if(e.type==='tracking_sniper'){this.attackWarnings.push({x:e.x,y:e.y,radius:5,life:1.35,kind:'SNIPER',owner:enemyIndex,angle:a});e.behavior!.heading={x:Math.cos(a),y:Math.sin(a)};e.behavior!.mode='aim';e.timer=5;}
        if(e.type==='arc_launcher'&&!e.behavior!.alerted){this.attackWarnings.push({x:this.player.x,y:this.player.y,radius:58,life:1.25,kind:'ARC',owner:enemyIndex});e.behavior!.alerted=true;e.timer=1.35;}
        else if(e.type==='burst_gunner'||e.type==='triple_gunner'){e.behavior!.mode='aim';this.attackWarnings.push({x:e.x,y:e.y,radius:0,life:e.type==='burst_gunner'?.7:.82,kind:e.type==='burst_gunner'?'BURST':'TRIPLE_GUNNER',owner:enemyIndex,angle:a});}
        else if(e.type==='ricochet_gunner'){const bullet=this.addBullet(e.x+Math.cos(a)*(e.radius+7),e.y+Math.sin(a)*(e.radius+7),a,'enemy');if(bullet){bullet.reflections=-2;bullet.source='ricochet_gunner';}}
        else if(e.type!=='tracking_sniper') {
          const count=e.type==='boss'?(this.stage===1?1:this.stage%10===0?this.bossSpec.shots:2):1;
          for(let shot=0;shot<count;shot++){const angle=a+(shot-(count-1)/2)*.17,bullet=this.addBullet(e.x+Math.cos(angle)*(e.radius+7),e.y+Math.sin(angle)*(e.radius+7),angle,'enemy');if(bullet)bullet.source=e.type;}if(e.type==='arc_launcher')e.behavior!.alerted=false;
        }this.onSound('enemy');
      }
      if (d < CONFIG.playerRadius + e.radius) this.die('CONTACT / 敵との接触');
    }
    const tetherPairs=new Map<number,Enemy[]>();for(const enemy of this.enemies)if(enemy.hp>0&&enemy.type==='tether_guard'&&enemy.squad!==undefined)tetherPairs.set(enemy.squad,[...(tetherPairs.get(enemy.squad)??[]),enemy]);for(const pair of tetherPairs.values())if(pair.length===2&&distance(pair[0],pair[1])<340){const a=pair[0],b=pair[1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((this.player.x-a.x)*dx+(this.player.y-a.y)*dy)/(dx*dx+dy*dy))),nearest={x:a.x+t*dx,y:a.y+t*dy};if(distance(nearest,this.player)<CONFIG.playerRadius+8)this.die('TETHER LINE / 連結防衛線');}
    const bulletWalls=[...this.layout.walls,...this.hazards.filter(h=>h.active&&h.source.type==='moving_wall').map(h=>h.rect),...this.enemyFields.filter(field=>field.kind!=='mine').map(field=>field.rect)];
    for (const b of this.bullets) {
      if (!b.active) continue; b.age += dt;
      if (b.owner === 'player' && distance(b, this.player) > CONFIG.playerRadius + b.radius + 6) b.armed = true;
      if (b.owner === 'enemy' && b.age > CONFIG.enemyBulletLifetime) { b.active = false; continue; }
      if(updateOrbiterRound(b,this.enemies,dt,this.elapsed))continue;
      if(b.source==='arc_launcher'&&!b.split&&b.age>.8){const base=Math.atan2(b.vy,b.vx),speed=140;for(const offset of[-.34,0,.34]){const shard=this.addBullet(b.x,b.y,base+offset,'enemy');if(shard){shard.vx=Math.cos(base+offset)*speed;shard.vy=Math.sin(base+offset)*speed;shard.source='arc_launcher';shard.split=true;}}b.active=false;continue;}
      applyEnemyBulletFields(b,this.enemies,dt,source=>{if(this.bullets.length>=CONFIG.maxBullets)return undefined;const clone=this.pool.pop()??{} as Bullet;Object.assign(clone,{...source,trail:[...source.trail],split:source.split,source:undefined,orbitTime:undefined,fieldHits:[...(source.fieldHits??[])]});this.bullets.push(clone);return clone;});
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
        if (collide) { b.x = Math.max(bounds.x + b.radius, Math.min(bounds.x + bounds.w - b.radius, oldX)); if (b.owner === 'enemy'&&!(b.source==='ricochet_gunner'&&b.reflections<0)) b.active = false; else this.reflect(b, 'x'); }
        if (!b.active) break;
        b.y += b.vy * dt / steps;
        collide = b.y < bounds.y + b.radius || b.y > bounds.y + bounds.h - b.radius || bulletWalls.some(w => circleRect(b, b.radius, w));
        if (collide) { b.y = Math.max(bounds.y + b.radius, Math.min(bounds.y + bounds.h - b.radius, oldY)); if (b.owner === 'enemy'&&!(b.source==='ricochet_gunner'&&b.reflections<0)) b.active = false; else this.reflect(b, 'y'); }
        if (!b.active) break;
        if (b.owner === 'player') for (const e of this.enemies) {
          const hitScale=1+.2*this.stacks('target')+(b.age<1?.1*this.stacks('pilot'):0)+(e.armor?.15*this.stacks('breach'):0);
          if (e.hp <= 0 || distance(b, e) > b.radius + e.radius * hitScale) continue;
          if(e.type==='phase_shift'&&e.behavior?.mode==='phase')continue;
          e.hit = .18;
          if(e.type==='front_shield'&&e.behavior?.heading){const incoming={x:-b.vx/Math.max(1,Math.hypot(b.vx,b.vy)),y:-b.vy/Math.max(1,Math.hypot(b.vx,b.vy))},normal=e.behavior.heading;if(incoming.x*normal.x+incoming.y*normal.y>.45){const dot=b.vx*normal.x+b.vy*normal.y;b.vx-=2*dot*normal.x;b.vy-=2*dot*normal.y;b.x=e.x+normal.x*(e.radius+b.radius+2);b.y=e.y+normal.y*(e.radius+b.radius+2);b.armed=true;b.reflections++;this.reflectionCount++;this.effects.push({x:e.x,y:e.y,age:.35,color:'#8ed5e7',text:'SHIELD'});break;}}
          if (e.armor) {
            e.armor = false; const len = Math.max(.01, distance(b, e)); const nx = (b.x - e.x) / len, ny = (b.y - e.y) / len; const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            const slow = Math.pow(.75, this.stacks('armor'))*Math.pow(.9,this.stacks('control')); b.vx *= slow; b.vy *= slow;
            const radius = e.radius * hitScale + b.radius + 1;
            b.x = e.x + nx * radius; b.y = e.y + ny * radius; b.armed = true; b.reflections++; this.reflectionCount++;this.weaponReflections[b.weapon??(b.heavy?'heavy':this.weapon)]++;
            this.effects.push({ x: e.x, y: e.y, age: .65, color: '#77d8ea', text: 'ARMOR BREAK' }); this.onSound('clang');
          } else {
            b.active = false; e.hp -= b.damage + (e.type==='boss'&&b.reflections===0?this.stacks('boss'):0); this.onSound('hit'); this.effects.push({ x: e.x, y: e.y, age: .35, color: '#ff8b73' });
            if(this.character==='fire')for(const other of this.enemies)if(other!==e&&other.hp>0&&!other.armor&&distance(other,e)<66){other.hp-=1;other.hit=.4;this.effects.push({x:other.x,y:other.y,age:.35,color:'#ff9975'});if(other.hp<=0)this.onEnemyKilled(other,b.weapon??this.weapon);}
            if(this.character==='ice')for(const other of this.enemies)if(other.hp>0&&distance(other,e)<100)other.slow=Math.max(other.slow??0,1.5);
            if(this.character==='thunder'){const other=this.enemies.find(other=>other!==e&&other.hp>0&&!other.armor&&distance(other,e)<135);if(other){other.hp-=1;other.hit=.4;this.effects.push({x:other.x,y:other.y,age:.35,color:'#e9d48e'});if(other.hp<=0)this.onEnemyKilled(other,b.weapon??this.weapon);}}
            if (e.hp <= 0) this.onEnemyKilled(e,b.weapon??(b.heavy?'heavy':this.weapon));
          }
          break;
        }
        if (b.active && b.armed && distance(b, this.player) < b.radius + CONFIG.playerRadius) { this.die(b.owner === 'player' ? 'OWN BULLET / 自分の跳弾' : 'ENEMY FIRE / 敵の弾', b); break; }
      }
      if (b.trail.length > 7) b.trail.shift(); b.trail.push({ x: b.x, y: b.y });
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) if (!this.bullets[i].active) { this.pool.push(this.bullets[i]); this.bullets.splice(i, 1); }
    for(const field of this.enemyFields){field.arm=Math.max(0,(field.arm??0)-dt);field.life-=dt;const owner=this.enemies[field.owner];if(field.life<=0||!owner||owner.hp<=0&&field.kind==='mine')field.life=0;else if(field.kind==='mine'&&field.arm===0&&circleRect(this.player,CONFIG.playerRadius,field.rect)){this.die('MINE / 地雷');field.life=0;}}
    this.enemyFields=this.enemyFields.filter(field=>field.life>0);
    for(const decoy of this.enemyDecoys){decoy.life-=dt;const owner=this.enemies[decoy.owner];if(!owner||owner.hp<=0)decoy.life=0;}this.enemyDecoys=this.enemyDecoys.filter(decoy=>decoy.life>0);
    for(const warning of this.attackWarnings){warning.life-=dt;if(warning.life<=0){if(warning.kind==='SNIPER'){const bullet=this.addBullet(warning.x,warning.y,warning.angle??0,'enemy');if(bullet){bullet.vx=Math.cos(warning.angle??0)*330;bullet.vy=Math.sin(warning.angle??0)*330;bullet.source='tracking_sniper';}}else if(warning.kind==='BURST'){const owner=this.enemies[warning.owner];if(owner?.hp>0){const angle=warning.angle??0,bullet=this.addBullet(owner.x+Math.cos(angle)*(owner.radius+7),owner.y+Math.sin(angle)*(owner.radius+7),angle,'enemy');if(bullet)bullet.source='burst_gunner';owner.behavior!.mode='burst';owner.behavior!.shotsLeft=4;owner.behavior!.modeTime=.14;}}else if(warning.kind==='TRIPLE_GUNNER'){const owner=this.enemies[warning.owner];if(owner?.hp>0)for(const offset of[-.2,0,.2]){const angle=(warning.angle??0)+offset,bullet=this.addBullet(owner.x+Math.cos(angle)*(owner.radius+7),owner.y+Math.sin(angle)*(owner.radius+7),angle,'enemy');if(bullet)bullet.source='triple_gunner';}}else if(warning.kind==='SHOCKWAVE'){const owner=this.enemies[warning.owner];if(owner&&distance(this.player,owner)<warning.radius+CONFIG.playerRadius&&Math.abs(Math.atan2(Math.sin(Math.atan2(this.player.y-owner.y,this.player.x-owner.x)-(warning.angle??0)),Math.cos(Math.atan2(this.player.y-owner.y,this.player.x-owner.x)-(warning.angle??0))))>.42)this.die('SHOCKWAVE / 衝撃波');}else if(['MORTAR','ARC','HOPPER','HUNKER SLAM'].includes(warning.kind)&&distance(this.player,warning)<warning.radius+CONFIG.playerRadius)this.die(`${warning.kind} / 爆発範囲`);}}
    this.attackWarnings=this.attackWarnings.filter(warning=>warning.life>0);
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
