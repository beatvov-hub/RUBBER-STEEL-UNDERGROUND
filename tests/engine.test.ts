import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine';
import { ABILITIES, CONFIG, FLOORS } from '../src/data';
import { REINFORCEMENT_TRIGGER_REMAINING } from '../src/world';
function sandbox() { const g = new Game(); g.start(); g.enemies = []; g.player = { x: 220, y: 515, hp: 1 }; return g; }
function step(g: Game, seconds: number) { for (let i = 0; i < seconds * 120; i++) g.update(CONFIG.fixedStep); }
test('player rounds survive more than 100 reflections without speed loss or lifetime expiry', () => {
  const g = sandbox();g.weapon='triple'; const b = g.addBullet(400, 240, 0, 'player')!;g.weapon='standard';step(g, 310);
  assert.equal(g.state, 'playing'); assert.ok(b.reflections > 100); assert.equal(g.bullets.length, 1); assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-CONFIG.bulletSpeed) < .001);assert.equal(g.weaponReflections.triple,b.reflections);assert.equal(g.weaponReflections.standard,0);
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
    const g = sandbox(); const e = { x:500,y:240,hp:2,armor:true,radius:15,type:'armored' as const,timer:3,hit:0 }; g.enemies=[e];
    const b=g.addBullet(470,240,0,'player',heavy)!; step(g,.1); assert.equal(e.armor,false); assert.equal(e.hp,2); assert.ok(b.vx<0); assert.equal(g.bullets.length,1);assert.equal(g.weaponReflections[heavy?'heavy':'standard'],1);
    g.addBullet(470,240,0,'player',heavy);step(g,.1);
    if(heavy)assert.ok(e.hp<=0);else{assert.equal(e.hp,1);g.addBullet(470,240,0,'player');step(g,.1);assert.ok(e.hp<=0);}
    assert.ok(g.bullets.includes(b));
  }
});
test('triple miss leaves all three rounds and population cap rejects entire volley', () => {
  const g=sandbox();g.weapon='triple';g.cooldown=0;g.shoot({x:850,y:120});g.player.x=210;g.player.y=540;step(g,.5);assert.equal(g.bullets.length,3);
  while(g.bullets.length<CONFIG.maxBullets-2)g.addBullet(600,240,0,'player');g.cooldown=0;const count=g.bullets.length;g.shoot({x:850,y:120});assert.equal(g.bullets.length,count);assert.match(g.message,/BULLET LIMIT/);
});
test('exit remains locked while enemies live; enemy clearance does not clear rounds',()=>{
  const g=new Game();g.start();g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);assert.equal(g.floor,0);
  g.enemies=[];const b=g.addBullet(400,240,0,'player')!;g.player={x:220,y:515,hp:1};step(g,.1);assert.ok(g.bullets.includes(b));
  g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);assert.equal(g.floor,1);assert.equal(g.bullets.length,0);
});
test('all ten floors and four ability selections advance to victory',()=>{
  const g=new Game();g.start();let selections=0;
  for(let f=0;f<10;f++){assert.equal(g.floor,f);g.enemies=[];g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);if(g.state==='choice'){assert.equal(g.choices.length,3);assert.equal(new Set(g.choices).size,3);g.choose(g.choices[0]);selections++;}}
  assert.equal(g.state,'stage-clear');assert.equal(selections,4);assert.equal(g.abilities.length,4);
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
test('reinforcement waves warn before spawning and keep the exit locked while queued',()=>{
  const g=new Game();g.start(41);const target=g.remaining;assert.ok(target>12);assert.equal(g.activeRemaining,12);
  const occupied=g.layout.reinforcements![0].anchors[0];g.player={...occupied,hp:1};
  for(const e of g.enemies)e.hp=0;
  step(g,.1);assert.ok(g.reinforcementWarning);assert.equal(g.remaining,9);
  step(g,2.1);assert.ok(g.activeRemaining>0);assert.ok(g.activeRemaining<=6);assert.equal(g.remaining,9);
  assert.ok(g.enemies.filter(e=>e.hp>0).every(e=>Math.hypot(e.x-g.player.x,e.y-g.player.y)>=100));
  for(const e of g.enemies)e.hp=0;step(g,.1);assert.ok(g.reinforcementWarning);assert.ok(g.reinforcementWarning.anchors.length>=1);assert.equal(g.remaining,3+g.reinforcementWarning.anchors.length);
});
test('reinforcement deployment stays under the 18-enemy live cap',()=>{
  const threshold=new Game();threshold.start(41);threshold.player={...threshold.exit,hp:1000};
  for(const e of threshold.enemies.slice(REINFORCEMENT_TRIGGER_REMAINING+1))e.hp=0;
  assert.equal(threshold.activeRemaining,REINFORCEMENT_TRIGGER_REMAINING+1);
  threshold.update(CONFIG.fixedStep);assert.equal(threshold.reinforcementWarning,undefined,'reinforcements must wait while five enemies remain');
  threshold.enemies[REINFORCEMENT_TRIGGER_REMAINING].hp=0;threshold.update(CONFIG.fixedStep);
  assert.ok(threshold.reinforcementWarning,'reinforcements should warn as soon as only four enemies remain');

  const g=new Game();g.start(41);g.player={...g.exit,hp:1000};
  for(const e of g.enemies.slice(REINFORCEMENT_TRIGGER_REMAINING))e.hp=0;
  assert.equal(g.activeRemaining,REINFORCEMENT_TRIGGER_REMAINING);
  g.update(CONFIG.fixedStep);assert.ok(g.reinforcementWarning);
  g.update(2.1);
  assert.ok(g.activeRemaining<=10,`four survivors plus one six-enemy wave should peak at ten, got ${g.activeRemaining}`);
  assert.ok(g.activeRemaining<=18);
});
test('pursuers close faster in later sectors while shooters orbit and retain single warned shots',()=>{
  const pursuerStep=(stage:number,type:'basic'|'armored')=>{const g=new Game();g.start(stage);g.player={x:300,y:500,hp:1};const e={x:900,y:500,hp:2,armor:type==='armored',radius:15,type,timer:100,hit:0};g.enemies=[e];g.update(.1);return 900-e.x;};
  const areaStages=[1,11,21,31,41];
  const basicSteps=areaStages.map(stage=>pursuerStep(stage,'basic')),armoredSteps=areaStages.map(stage=>pursuerStep(stage,'armored'));
  for(let i=0;i<areaStages.length;i++){
    assert.ok(Math.abs(basicSteps[i]-(5+i*.4))<.001);assert.ok(Math.abs(armoredSteps[i]-(3.8+i*.4))<.001);
    if(i)assert.ok(basicSteps[i]>basicSteps[i-1]&&armoredSteps[i]>armoredSteps[i-1]);
    assert.ok(armoredSteps[i]<basicSteps[i]);
  }
  const shooter=new Game();shooter.start(11);shooter.player={x:500,y:300,hp:1};const e={x:780,y:300,hp:1,armor:false,radius:15,type:'shooter' as const,timer:100,hit:0};shooter.enemies=[e];shooter.update(.1);assert.notEqual(e.y,300);
  const nextShot=(stage:number)=>{const g=new Game();g.start(stage);const e={x:800,y:180,hp:1,armor:false,radius:15,type:'shooter' as const,timer:0,hit:0};g.enemies=[e];g.update(CONFIG.fixedStep);assert.equal(g.bullets.filter(b=>b.owner==='enemy').length,1);return e.timer;};
  const shooterIntervals=areaStages.map(stage=>nextShot(stage));
  for(let i=0;i<areaStages.length;i++){
    assert.ok(Math.abs(shooterIntervals[i]-(3.5-.13*i))<.001);
    if(i)assert.ok(shooterIntervals[i]<shooterIntervals[i-1]);
  }
});

test('pursuers separate instead of collapsing into a single contact stack',()=>{
  const g=sandbox();g.player={x:220,y:300,hp:1};g.enemies=[0,1,2,3].map(()=>({x:500,y:300,hp:1,armor:false,radius:15,type:'basic' as const,timer:3,hit:0}));
  step(g,3);const live=g.enemies.filter(e=>e.hp>0);let min=Infinity;for(let i=0;i<live.length;i++)for(let j=0;j<i;j++)min=Math.min(min,Math.hypot(live[i].x-live[j].x,live[i].y-live[j].y));
  assert.ok(min>=30,`enemy bodies should not overlap, got ${min.toFixed(1)}px`);
});
test('TRIPLE clears a close three-target spread in one volley and HEAVY rewards a precise boss hit',()=>{
  const cluster=sandbox();cluster.player={x:400,y:240,hp:1};cluster.enemies=[198,240,282].map(y=>({x:550,y,hp:1,armor:false,radius:15,type:'basic' as const,timer:100,hit:0}));
  cluster.weapon='triple';cluster.cooldown=0;cluster.shoot({x:900,y:240});step(cluster,.8);assert.equal(cluster.kills,3);assert.equal(cluster.remaining,0);assert.deepEqual(cluster.weaponKills,{standard:0,triple:3,heavy:0});assert.equal(cluster.weaponFires.triple,1);
  const heavy=new Game();heavy.start(50);heavy.floor=9;heavy.loadFloor();const boss=heavy.enemies.find(e=>e.type==='boss')!;boss.x=550;boss.y=300;boss.hp=heavy.bossSpec.hp;boss.armor=false;heavy.enemies=[boss];heavy.player={x:450,y:300,hp:1};const round=heavy.addBullet(520,300,0,'player',true)!;step(heavy,.5);assert.equal(boss.hp,heavy.bossSpec.hp-3);assert.equal(round.damage,3);
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
