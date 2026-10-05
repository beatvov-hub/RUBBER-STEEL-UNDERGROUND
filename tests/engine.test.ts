import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine';
import { ABILITIES, CONFIG, FLOORS } from '../src/data';
function sandbox() { const g = new Game(); g.start(); g.enemies = []; g.player = { x: 220, y: 515, hp: 1 }; return g; }
function step(g: Game, seconds: number) { for (let i = 0; i < seconds * 120; i++) g.update(CONFIG.fixedStep); }
test('player rounds survive more than 100 reflections without speed loss or lifetime expiry', () => {
  const g = sandbox(); const b = g.addBullet(400, 240, 0, 'player')!; step(g, 310);
  assert.equal(g.state, 'playing'); assert.ok(b.reflections > 100); assert.equal(g.bullets.length, 1); assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-CONFIG.bulletSpeed) < .001);
});
test('hitting an unarmored enemy consumes only the impacting player round', () => {
  const g = sandbox(); g.enemies = [{ x: 500, y: 240, hp: 1, armor: false, radius: 15, type: 'basic', timer: 3, hit: 0 }];
  g.addBullet(475,240,0,'player'); const spare = g.addBullet(600, 120, 0, 'player')!;
  step(g, .1); assert.equal(g.remaining,0); assert.equal(g.bullets.length,1); assert.equal(g.bullets[0], spare);
});
test('a missed player round comes back and kills its owner', () => {
  const g = sandbox(); g.player.x = 400; g.player.y = 240; g.cooldown = 0; g.shoot({x:900,y:240}); step(g,4);
  assert.equal(g.state,'dead'); assert.match(g.deathCause,/OWN BULLET/); assert.equal(g.bullets.length,1); assert.ok(g.fatalBullet);
});
test('armor reflects the first shot and breaks, second hit kills; heavy also reflects', () => {
  for (const heavy of [false,true]) {
    const g = sandbox(); const e = { x:500,y:240,hp:1,armor:true,radius:15,type:'armored' as const,timer:3,hit:0 }; g.enemies=[e];
    const b=g.addBullet(470,240,0,'player',heavy)!; step(g,.1); assert.equal(e.armor,false); assert.equal(e.hp,1); assert.ok(b.vx<0); assert.equal(g.bullets.length,1);
    g.addBullet(470,240,0,'player',heavy);step(g,.1);assert.ok(e.hp<=0);assert.ok(g.bullets.includes(b));
  }
});
test('triple miss leaves all three rounds and population cap rejects entire volley', () => {
  const g=sandbox();g.weapon='triple';g.cooldown=0;g.shoot({x:850,y:120});g.player.x=210;g.player.y=540;step(g,.5);assert.equal(g.bullets.length,3);
  while(g.bullets.length<CONFIG.maxBullets-2)g.addBullet(600,240,0,'player');g.cooldown=0;const count=g.bullets.length;g.shoot({x:850,y:120});assert.equal(g.bullets.length,count);assert.match(g.message,/CAPACITY/);
});
test('exit remains locked while enemies live; enemy clearance does not clear rounds',()=>{
  const g=new Game();g.start();g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);assert.equal(g.floor,0);
  g.enemies=[];const b=g.addBullet(400,240,0,'player')!;g.player={x:220,y:515,hp:1};step(g,.1);assert.ok(g.bullets.includes(b));
  g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);assert.equal(g.floor,1);assert.equal(g.bullets.length,0);
});
test('all ten floors and four ability selections advance to victory',()=>{
  const g=new Game();g.start();let selections=0;
  for(let f=0;f<10;f++){assert.equal(g.floor,f);g.enemies=[];g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);if(g.state==='choice'){assert.equal(g.choices.length,3);assert.equal(new Set(g.choices).size,3);g.choose(g.choices[0]);selections++;}}
  assert.equal(g.state,'won');assert.equal(selections,4);assert.equal(g.abilities.length,4);
});
test('each modifier preserves player vulnerability and indefinite reflection',()=>{
  for(const a of ABILITIES){const g=sandbox();g.abilities=[a.id];const b=g.addBullet(400,240,0,'player',true)!;step(g,500);assert.ok(b.reflections>100);assert.equal(g.bullets.length,1);g.player.x=b.x;g.player.y=b.y;g.update(CONFIG.fixedStep);assert.equal(g.state,'dead');}
});
test('death and immediate retry reset acquired abilities and all rounds',()=>{
  const g=sandbox();g.floor=7;g.abilities=['slow','magnet'];g.addBullet(600,240,0,'player');g.die('test');assert.deepEqual(g.abilities,[]);g.retry();assert.equal(g.state,'playing');assert.equal(g.floor,7);assert.equal(g.bullets.length,0);assert.equal(g.weapon,'standard');
});
test('not shooting creates no self hazard but does not clear enemies',()=>{
  const g=new Game();g.start();step(g,1);assert.equal(g.bullets.length,0);assert.equal(g.remaining,1);assert.equal(g.floor,0);
});
test('firing beside steel never spawns a trapped round inside the wall',()=>{
  const g=sandbox();g.player={x:938,y:250,hp:1};g.weapon='heavy';g.cooldown=0;g.shoot({x:1100,y:250});const b=g.bullets[0];assert.ok(b.x+b.radius<=950);step(g,.2);assert.equal(g.state,'dead');assert.match(g.deathCause,/OWN BULLET/);assert.ok(b.reflections<=2);
});
test('180 stray bullets persist and update within a practical time budget',()=>{
  const g=sandbox();g.player.hp=100000;for(let i=0;i<CONFIG.maxBullets;i++)g.addBullet(400+i%10,240,(i/CONFIG.maxBullets)*Math.PI*2,'player');const start=performance.now();step(g,10);assert.equal(g.bullets.length,CONFIG.maxBullets);assert.ok(performance.now()-start<2500);
});
test('all floor spawn points, entry, and exit are accessible and clear of obstacles',()=>{
  // Flood-fill at a player-sized resolution checks each authored layout for sealed regions.
  for(let f=0;f<FLOORS.length;f++){const g=new Game();g.floor=f;const bounds=g.layout.bounds;const cell=8;const free=(x:number,y:number)=>x>=bounds.x+12&&y>=bounds.y+12&&x<=bounds.x+bounds.w-12&&y<=bounds.y+bounds.h-12&&!g.layout.walls.some(w=>x>w.x-12&&x<w.x+w.w+12&&y>w.y-12&&y<w.y+w.h+12);const sx=Math.round(g.entry.x/cell),sy=Math.round(g.entry.y/cell);const seen=new Set([`${sx},${sy}`]);const queue=[[sx,sy]];for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [nx,ny]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const key=`${nx},${ny}`;if(!seen.has(key)&&free(nx*cell,ny*cell)){seen.add(key);queue.push([nx,ny]);}}}for(const p of[g.exit,...g.layout.enemies])assert.ok(seen.has(`${Math.round(p.x/cell)},${Math.round(p.y/cell)}`),`floor ${f+1}: inaccessible ${p.x},${p.y}`);}
});
