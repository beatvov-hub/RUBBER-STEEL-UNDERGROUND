import { ABILITIES, CHARACTERS, CONFIG, FLOORS, WEAPONS, type Ability, type EnemyType, type Rect, type Vec, type Weapon } from './data';
export type Bullet = Vec & { vx: number; vy: number; radius: number; damage: number; active: boolean; owner: 'player' | 'enemy'; reflections: number; age: number; armed: boolean; heavy: boolean; trail: Vec[] };
export type Enemy = Vec & { type: EnemyType; hp: number; armor: boolean; radius: number; timer: number; hit: number };
export type Effect = Vec & { age: number; color: string; text?: string };
export type State = 'title' | 'playing' | 'paused' | 'dead' | 'choice' | 'won';
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function circleRect(p: Vec, radius: number, r: Rect) {
  return Math.hypot(p.x - Math.max(r.x, Math.min(p.x, r.x + r.w)), p.y - Math.max(r.y, Math.min(p.y, r.y + r.h))) < radius;
}
export class Game {
  state: State = 'title'; floor = 0; weapon: Weapon = 'standard'; abilities: Ability[] = [];
  player = { x: 0, y: 0, hp: CONFIG.playerHP }; bullets: Bullet[] = []; pool: Bullet[] = []; enemies: Enemy[] = []; effects: Effect[] = [];
  cooldown = 0; elapsed = 0; shots = 0; kills = 0; reflectionCount = 0; message = ''; messageTime = 0;
  deathCause = ''; fatalBullet?: Bullet; choices: Ability[] = []; onSound: (kind: string) => void = () => {}; onChange: () => void = () => {};
  get layout() { return FLOORS[this.floor]; }
  get entry() { const b = this.layout.bounds; return { x: b.x + 45, y: b.y + b.h - 45 }; }
  get exit() { const b = this.layout.bounds; return { x: b.x + b.w - 45, y: b.y + 45 }; }
  get remaining() { return this.enemies.filter(e => e.hp > 0).length; }
  stacks(id: Ability) { return this.abilities.filter(a => a === id).length; }
  start() { this.floor = 0; this.abilities = []; this.weapon = 'standard'; this.elapsed = 0; this.shots = 0; this.kills = 0; this.reflectionCount = 0; this.loadFloor(); }
  loadFloor() {
    for (const b of this.bullets) { b.active = false; this.pool.push(b); } this.bullets = [];
    this.player = { ...this.entry, hp: CHARACTERS[0].hp }; this.enemies = this.layout.enemies.map(e => ({ ...e, hp: e.type === 'boss' ? 18 : 1, armor: e.type === 'armored', radius: e.type === 'boss' ? 33 : 15, timer: 2.5, hit: 0 }));
    this.effects = []; this.fatalBullet = undefined; this.cooldown = .35; this.state = 'playing'; this.toast(`FLOOR ${String(this.floor + 1).padStart(2, '0')} / ${this.layout.name}`); this.onChange();
  }
  retry() { this.abilities = []; this.weapon = 'standard'; this.loadFloor(); }
  toast(message: string) { this.message = message; this.messageTime = 2.8; }
  setWeapon(weapon: Weapon) { this.weapon = weapon; this.onChange(); }
  addBullet(x: number, y: number, angle: number, owner: 'player' | 'enemy', heavy = false) {
    if (this.bullets.length >= CONFIG.maxBullets) return;
    const w = WEAPONS[heavy ? 'heavy' : this.weapon];
    const speed = owner === 'enemy' ? 170 : w.speed * Math.pow(.85, this.stacks('slow'));
    const b = this.pool.pop() ?? {} as Bullet;
    Object.assign(b, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: owner === 'enemy' ? 5 : w.radius, damage: owner === 'enemy' ? 1 : w.damage + (heavy ? 2 * this.stacks('power') : 0), active: true, owner, reflections: 0, age: 0, armed: owner === 'enemy', heavy, trail: [] });
    this.bullets.push(b); return b;
  }
  shoot(target: Vec) {
    if (this.state !== 'playing' || this.cooldown > 0) return;
    const w = WEAPONS[this.weapon];
    if (this.bullets.length + w.angles.length > CONFIG.maxBullets) { this.toast('CAPACITY FULL — 敵に当てて弾を回収'); return; }
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    // Keep the muzzle out of steel even when firing directly beside a wall.
    for (const offset of w.angles) {
      let muzzle = 22; const bounds = this.layout.bounds;
      while (muzzle > 0) {
        const point = { x: this.player.x + Math.cos(angle + offset) * muzzle, y: this.player.y + Math.sin(angle + offset) * muzzle };
        if (point.x >= bounds.x + w.radius && point.x <= bounds.x + bounds.w - w.radius && point.y >= bounds.y + w.radius && point.y <= bounds.y + bounds.h - w.radius && !this.layout.walls.some(r => circleRect(point, w.radius, r))) break;
        muzzle -= 1;
      }
      this.addBullet(this.player.x + Math.cos(angle + offset) * muzzle, this.player.y + Math.sin(angle + offset) * muzzle, angle + offset, 'player', this.weapon === 'heavy');
    }
    this.cooldown = w.cooldown; this.shots += w.angles.length; this.onSound('shot');
  }
  moveCircle(p: Vec, dx: number, dy: number, radius: number) {
    const b = this.layout.bounds;
    const oldX = p.x; p.x = Math.max(b.x + radius, Math.min(b.x + b.w - radius, p.x + dx));
    if (this.layout.walls.some(w => circleRect(p, radius, w))) p.x = oldX;
    const oldY = p.y; p.y = Math.max(b.y + radius, Math.min(b.y + b.h - radius, p.y + dy));
    if (this.layout.walls.some(w => circleRect(p, radius, w))) p.y = oldY;
  }
  reflect(b: Bullet, axis: 'x' | 'y') {
    if (axis === 'x') b.vx *= -1; else b.vy *= -1;
    b.reflections++; b.armed = true; this.reflectionCount++;
    this.effects.push({ x: b.x, y: b.y, age: .2, color: '#e7fa9e' }); this.onSound('bounce');
  }
  update(dt: number, movement: Vec = { x: 0, y: 0 }, target?: Vec, firing = false) {
    if (this.state !== 'playing') return;
    this.elapsed += dt; this.cooldown -= dt; this.messageTime -= dt;
    const norm = Math.max(1, Math.hypot(movement.x, movement.y));
    const speed = CONFIG.playerSpeed * (1 + .15 * this.stacks('move'));
    this.moveCircle(this.player, movement.x / norm * speed * dt, movement.y / norm * speed * dt, CONFIG.playerRadius);
    if (firing && target) this.shoot(target);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue; e.timer -= dt; e.hit = Math.max(0, e.hit - dt);
      const d = distance(e, this.player), a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const move = e.type === 'shooter' ? (d > 330 ? 38 : d < 200 ? -30 : 0) : e.type === 'boss' ? 27 : e.type === 'armored' ? 39 : 51;
      // Axis steering lets pursuers round corners without teleporting through steel.
      const before = { x: e.x, y: e.y };
      this.moveCircle(e, Math.cos(a) * move * dt, Math.sin(a) * move * dt, e.radius);
      if (move && distance(before, e) < .01) this.moveCircle(e, Math.sin(a) * move * dt, -Math.cos(a) * move * dt, e.radius);
      if ((e.type === 'shooter' || e.type === 'boss') && e.timer <= 0) {
        e.timer = e.type === 'boss' ? 3.2 : 3.7;
        this.addBullet(e.x + Math.cos(a) * (e.radius + 7), e.y + Math.sin(a) * (e.radius + 7), a, 'enemy'); this.onSound('enemy');
      }
      if (d < CONFIG.playerRadius + e.radius) this.die('CONTACT / 敵との接触');
    }
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
        let collide = b.x < bounds.x + b.radius || b.x > bounds.x + bounds.w - b.radius || this.layout.walls.some(w => circleRect(b, b.radius, w));
        if (collide) { b.x = Math.max(bounds.x + b.radius, Math.min(bounds.x + bounds.w - b.radius, oldX)); if (b.owner === 'enemy') b.active = false; else this.reflect(b, 'x'); }
        if (!b.active) break;
        b.y += b.vy * dt / steps;
        collide = b.y < bounds.y + b.radius || b.y > bounds.y + bounds.h - b.radius || this.layout.walls.some(w => circleRect(b, b.radius, w));
        if (collide) { b.y = Math.max(bounds.y + b.radius, Math.min(bounds.y + bounds.h - b.radius, oldY)); if (b.owner === 'enemy') b.active = false; else this.reflect(b, 'y'); }
        if (!b.active) break;
        if (b.owner === 'player') for (const e of this.enemies) {
          if (e.hp <= 0 || distance(b, e) > b.radius + e.radius * (1 + .2 * this.stacks('target'))) continue;
          e.hit = .18;
          if (e.armor) {
            e.armor = false; const len = Math.max(.01, distance(b, e)); const nx = (b.x - e.x) / len, ny = (b.y - e.y) / len; const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            const slow = Math.pow(.75, this.stacks('armor')); b.vx *= slow; b.vy *= slow;
            const radius = e.radius * (1 + .2 * this.stacks('target')) + b.radius + 1;
            b.x = e.x + nx * radius; b.y = e.y + ny * radius; b.armed = true; b.reflections++; this.reflectionCount++;
            this.effects.push({ x: e.x, y: e.y, age: .65, color: '#77d8ea', text: 'ARMOR BREAK' }); this.onSound('clang');
          } else {
            b.active = false; e.hp -= b.damage; this.onSound('hit'); this.effects.push({ x: e.x, y: e.y, age: .35, color: '#ff8b73' });
            if (e.hp <= 0) { this.kills++; if (!this.remaining) { this.toast('EXIT OPEN — 残った自弾に注意'); this.onSound('open'); this.onChange(); } }
          }
          break;
        }
        if (b.active && b.armed && distance(b, this.player) < b.radius + CONFIG.playerRadius) { this.die(b.owner === 'player' ? 'OWN BULLET / 自分の跳弾' : 'ENEMY FIRE / 敵の弾', b); break; }
      }
      if (b.trail.length > 7) b.trail.shift(); b.trail.push({ x: b.x, y: b.y });
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) if (!this.bullets[i].active) { this.pool.push(this.bullets[i]); this.bullets.splice(i, 1); }
    this.effects = this.effects.filter(e => (e.age -= dt) > 0);
    if (this.state === 'playing' && !this.remaining && distance(this.player, this.exit) < 26) this.advance();
  }
  die(cause: string, bullet?: Bullet) {
    if (this.state !== 'playing') return;
    this.player.hp--; if (this.player.hp > 0) return;
    this.state = 'dead'; this.deathCause = cause; this.fatalBullet = bullet; this.abilities = []; this.onSound('dead'); this.onChange();
  }
  advance() {
    if (this.floor === 9) { this.state = 'won'; this.onChange(); return; }
    if (CONFIG.abilityFloors.includes(this.floor + 1)) {
      this.choices = [...ABILITIES].sort(() => Math.random() - .5).slice(0, 3).map(a => a.id); this.state = 'choice'; this.onChange();
    } else { this.floor++; this.loadFloor(); }
  }
  choose(id: Ability) { if (this.state !== 'choice' || !this.choices.includes(id)) return; this.abilities.push(id); this.floor++; this.loadFloor(); }
}
