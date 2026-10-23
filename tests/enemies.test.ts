import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Enemy, type Bullet } from '../src/engine';
import { CONFIG } from '../src/data';
import { ENEMY_TYPES, NEW_ENEMY_TYPES } from '../src/enemies/types';
import { enemyDefinition } from '../src/enemies/definitions';
import { capSpecialEnemies, floorFor } from '../src/world';

function isolated(type: typeof ENEMY_TYPES[number], enemyX=700, enemyY=300) {
  const game=new Game();game.start(45);game.player={x:300,y:300,hp:1};
  const def=enemyDefinition(type),enemy:Enemy={x:enemyX,y:enemyY,type,hp:def.hp,armor:type==='armored',radius:def.radius,timer:2.5,hit:0,slow:0,behavior:{}};
  game.enemies=[enemy];game.reinforcementQueue=[];return {game,enemy};
}

test('all 42 new enemy IDs are present in eligible floors across the deterministic 500-floor campaign',()=>{
  assert.equal(NEW_ENEMY_TYPES.length,42);const found=new Set<string>();
  for(let stage=1;stage<=50;stage++)for(let floor=1;floor<=10;floor++){const plan=floorFor(stage,floor);for(const e of plan.enemies)found.add(e.type);for(const wave of plan.reinforcements??[])for(const type of wave.types)found.add(type);}
  for(const type of NEW_ENEMY_TYPES)assert.ok(found.has(type),`${type} never spawns`);
});

test('ten new special archetypes unlock gradually and stay capped at three per floor',()=>{
  const added=ENEMY_TYPES.slice(36);assert.equal(added.length,10);assert.ok(added.every(type=>enemyDefinition(type).category==='special'));
  for(const type of added)assert.ok(ENEMY_TYPES.some(candidate=>candidate===type));
  const testSet=added.map((type,index)=>({type,x:100+index*20,y:100}));capSpecialEnemies(testSet);
  assert.ok(testSet.filter(enemy=>enemyDefinition(enemy.type).category==='special').length<=3);
  const found=new Set<string>();for(let stage=1;stage<=50;stage++)for(let floor=1;floor<=10;floor++){
    const plan=floorFor(stage,floor),spawns=[...plan.enemies,...(plan.reinforcements??[]).flatMap(wave=>wave.types.map(type=>({type,x:0,y:0})))];
    for(const enemy of spawns){if(enemyDefinition(enemy.type).category==='special')assert.ok(enemyDefinition(enemy.type).unlockStage<=stage);found.add(enemy.type);}
    assert.ok(spawns.filter(enemy=>enemyDefinition(enemy.type).category==='special').length<=3,`too many pressure enemies at ${stage}:${floor}`);
  }
  for(const type of added)assert.ok(found.has(type),`${type} never appears`);
  assert.ok(floorFor(12,5).enemies.every(enemy=>!added.includes(enemy.type as typeof added[number])),'new types must not leak before unlock');
});

test('CLUSTER BOMBER warns, then can be safely outrun',()=>{
  const {game,enemy}=isolated('bomber',410,300);game.player={x:300,y:300,hp:1};enemy.timer=0;game.update(.02);
  assert.ok(game.attackWarnings.some(warning=>warning.kind==='BOMBER'));game.player={x:650,y:500,hp:1};game.update(1.1);
  assert.equal(enemy.hp,0);assert.equal(game.state,'playing');
});

test('BURROWER marks its emergence, ignores fire underground, and relocates',()=>{
  const {game,enemy}=isolated('burrower',620,300);game.player={x:300,y:300,hp:1};enemy.timer=0;game.update(.02);
  assert.equal(enemy.behavior?.mode,'burrow');const landing={...enemy.behavior!.landing!};assert.ok(game.attackWarnings.some(warning=>warning.kind==='BURROW'));
  const bullet:Bullet={x:enemy.x-38,y:enemy.y,vx:190,vy:0,radius:4,damage:1,active:true,owner:'player',reflections:0,age:1,armed:true,heavy:false,weapon:'standard',trail:[]};game.bullets=[bullet];game.update(.15);
  assert.equal(enemy.hp,2);game.update(.9);assert.equal(enemy.behavior?.mode,'recover');assert.ok(Math.hypot(enemy.x-landing.x,enemy.y-landing.y)<1);
});

test('SENTINEL uses a rotating line warning before firing its predictable round',()=>{
  const {game,enemy}=isolated('sentinel',700,300);game.debugInvincible=true;enemy.timer=0;game.update(.02);
  assert.ok(game.attackWarnings.some(warning=>warning.kind==='SENTINEL'));game.update(.8);
  const rounds=game.bullets.filter(bullet=>bullet.owner==='enemy');assert.equal(rounds.length,1);assert.equal(rounds[0].source,'sentinel');
});

test('BEAM WEAVER shows a tracking sweep and resolves a single dodgeable ray',()=>{
  const {game,enemy}=isolated('beam_weaver',700,300);game.player={x:300,y:300,hp:1};enemy.timer=0;game.update(.02);
  const warning=game.attackWarnings.find(item=>item.kind==='BEAM');assert.ok(warning);const before=warning.angle;game.update(.55);assert.notEqual(warning.angle,before);
  assert.equal(game.bullets.filter(bullet=>bullet.owner==='enemy').length,0);assert.ok(warning.life>0);
});

test('GUARDIAN grants a short-lived armor pulse and WEBBER creates a readable slow zone',()=>{
  const guardian=isolated('guardian',500,300);guardian.enemy.timer=0;const ally:Enemy={x:550,y:300,type:'basic',hp:1,armor:false,radius:15,timer:5,hit:0,slow:0};guardian.game.enemies.push(ally);guardian.game.update(.02);
  assert.equal(ally.armor,true);assert.ok((ally.behavior?.guardTime??0)>4);guardian.game.update(5.1);assert.equal(ally.armor,false);
  const webber=isolated('webber',520,300);webber.game.player={x:300,y:300,hp:1};webber.enemy.timer=0;webber.game.update(.02);assert.ok(webber.game.attackWarnings.some(warning=>warning.kind==='WEB'));webber.game.update(.95);
  assert.ok(webber.game.enemyFields.some(field=>field.kind==='web'));const start=webber.game.player.x;webber.game.update(.1,{x:1,y:0});const slowedDelta=webber.game.player.x-start;
  assert.ok(slowedDelta>0&&slowedDelta<15,`web movement should be reduced, got ${slowedDelta}`);
});

test('HIVE CALLER summons only two weak reinforcements once and within the live cap',()=>{
  const {game,enemy}=isolated('hive_caller',700,300);game.debugInvincible=true;enemy.hp=1;game.update(.02);assert.equal(enemy.behavior?.used,true);
  assert.equal(game.attackWarnings.filter(warning=>warning.kind==='HIVE').length,2);game.update(.95);
  assert.equal(game.activeRemaining,3);assert.ok(game.activeRemaining<=12);assert.equal(game.enemies.filter(candidate=>candidate.type==='dasher').length,2);
});

test('REANIMATOR channels before reviving one non-boss ally only once',()=>{
  const {game,enemy}=isolated('reanimator',500,300);game.player={x:200,y:300,hp:1};const corpse:Enemy={x:525,y:300,type:'basic',hp:0,armor:false,radius:15,timer:1,hit:0,behavior:{}};game.enemies.push(corpse);enemy.timer=0;
  game.update(.02);assert.equal(enemy.behavior?.mode,'channel');assert.ok(game.attackWarnings.some(warning=>warning.kind==='REVIVE'));game.update(1.3);
  assert.equal(corpse.hp,1);assert.equal(corpse.behavior?.reanimated,true);assert.equal(enemy.behavior?.used,true);
  const capped=isolated('reanimator',700,300),waiting:Enemy={x:720,y:300,type:'basic',hp:0,armor:false,radius:15,timer:1,hit:0,behavior:{}};capped.game.debugInvincible=true;capped.enemy.timer=0;capped.game.enemies=[capped.enemy,...Array.from({length:11},(_,index)=>({x:500+index*24,y:500,type:'basic' as const,hp:1,armor:false,radius:15,timer:5,hit:0,behavior:{}})),waiting];
  capped.game.update(.02);assert.equal(capped.game.activeRemaining,12);assert.equal(capped.game.attackWarnings.some(warning=>warning.kind==='REVIVE'),false,'revival must not break the live-enemy cap');
});

test('DUELIST fires a warned pair while SIEGE CANNON marks separated landing zones',()=>{
  const duelist=isolated('duelist',700,300);duelist.game.debugInvincible=true;duelist.enemy.timer=0;duelist.game.update(.02);assert.ok(duelist.game.attackWarnings.some(warning=>warning.kind==='DUELIST'));duelist.game.update(.7);assert.equal(duelist.game.bullets.filter(bullet=>bullet.owner==='enemy').length,2);
  const siege=isolated('siege_cannon',700,300);siege.enemy.timer=0;siege.game.update(.02);const warnings=siege.game.attackWarnings.filter(warning=>warning.kind==='SIEGE');assert.equal(warnings.length,3);siege.game.player={x:300,y:300,hp:1};siege.game.update(1.4);assert.equal(siege.game.state,'playing');
  siege.enemy.timer=0;siege.game.update(.02);const target=siege.game.attackWarnings.find(warning=>warning.kind==='SIEGE')!;siege.game.player={x:target.x,y:target.y,hp:1};siege.game.update(1.4);assert.equal(siege.game.state,'dead');
});

test('DASHER telegraphs a locked heading, dashes, then recovers',()=>{
  const {game,enemy}=isolated('dasher',600,300);enemy.timer=0;game.update(.02);assert.equal(enemy.behavior?.mode,'windup');assert.ok(enemy.behavior?.heading);game.update(.8);assert.equal(enemy.behavior?.mode,'dash');game.update(.5);assert.equal(enemy.behavior?.mode,'recover');
});

test('DASHER stops its charge at a steel obstruction',()=>{
  const {game,enemy}=isolated('dasher',600,300),wall={x:480,y:250,w:40,h:100};game.layout.walls.push(wall);enemy.timer=0;game.update(.02);game.update(.8);assert.equal(enemy.behavior?.mode,'dash');game.update(.3);assert.equal(enemy.behavior?.mode,'recover');game.layout.walls.pop();
});

test('TRIGGER HOUND accelerates in response to firing and PACK RUNNER siblings surge after a kill',()=>{
  const game=new Game();game.start(15);game.player={x:250,y:300,hp:1};game.cooldown=0;const hound:Enemy={x:700,y:250,type:'trigger_hound',hp:1,armor:false,radius:15,timer:10,hit:0,slow:0,behavior:{}};game.enemies=[hound];game.shoot({x:700,y:250});assert.ok((hound.behavior?.triggerBoost??0)>0);
  const mate:Enemy={x:500,y:300,type:'pack_runner',hp:1,armor:false,radius:14,timer:10,hit:0,slow:0,squad:9,behavior:{}};const dead:Enemy={x:540,y:300,type:'pack_runner',hp:1,armor:false,radius:14,timer:10,hit:0,slow:0,squad:9,behavior:{}};game.enemies=[mate,dead];dead.hp=0;(game as any).onEnemyKilled(dead,'standard');assert.ok((mate.behavior?.packBoost??0)>0);
});

test('FRONT SHIELD reflects frontal shots while PHASE SHIFT lets phased rounds pass',()=>{
  const {game,enemy}=isolated('front_shield',500,300);game.player={x:400,y:300,hp:1};enemy.behavior!.heading={x:-1,y:0};game.bullets=[{x:480,y:300,vx:285,vy:0,radius:4,damage:1,active:true,owner:'player',reflections:0,age:1,armed:true,heavy:false,weapon:'standard',trail:[]}];game.update(.05);assert.equal(game.bullets[0].owner,'player');assert.ok(game.bullets[0].vx<0);
  const phased=isolated('phase_shift',500,300);phased.game.player={x:300,y:300,hp:1};phased.enemy.behavior!.phaseTime=2.6;phased.game.bullets=[{x:480,y:300,vx:285,vy:0,radius:4,damage:1,active:true,owner:'player',reflections:0,age:1,armed:true,heavy:false,weapon:'standard',trail:[]}];phased.game.update(.05);assert.equal(phased.enemy.hp,1);assert.ok(phased.game.bullets[0].active);
});

test('SPLITTER children remain in the exit-clear count',()=>{
  const {game,enemy}=isolated('splitter',500,300);game.player={x:220,y:300,hp:1};game.reinforcementQueue=[];game.bullets=[{x:470,y:300,vx:285,vy:0,radius:4,damage:1,active:true,owner:'player',reflections:0,age:1,armed:true,heavy:false,weapon:'standard',trail:[]}];game.update(.1);assert.equal(game.activeRemaining,2);assert.equal(game.remaining,2);assert.ok(game.enemies.some(e=>e!==enemy&&e.hp>0&&e.type==='dasher'));
});

test('REPAIR BOT restores only living damaged ARMORED and HUNKER stays slow and durable',()=>{
  const game=new Game();game.start(45);game.player={x:200,y:300,hp:1};const bot={x:500,y:300,type:'repair_bot' as const,hp:2,armor:false,radius:15,timer:0,hit:0,slow:0,behavior:{}};const target={x:550,y:300,type:'armored' as const,hp:1,armor:false,radius:15,timer:10,hit:0,slow:0,behavior:{}};game.enemies=[bot,target];game.update(.02);assert.equal(target.armor,true);
  const heavy=isolated('hunker',700,300);const x=heavy.enemy.x;heavy.game.update(.1);assert.ok(heavy.enemy.x<=x);assert.equal(heavy.enemy.hp,5);
});

test('special player-bullet fields preserve ownership, cap and return behavior',()=>{
  for(const type of ['magnetizer','accelerator','slow_field','prism_splitter','moving_mirror','bullet_orbiter'] as const){const {game}=isolated(type,500,300);const bullet:Bullet={x:460,y:300,vx:200,vy:12,radius:4,damage:1,active:true,owner:'player',reflections:0,age:1,armed:true,heavy:false,weapon:'standard',trail:[]};game.bullets=[bullet];if(type==='prism_splitter')game.pool.push({...bullet,owner:'enemy',source:'bullet_orbiter',orbitTime:8,fieldHits:['bullet_orbiter']});const speed=Math.hypot(bullet.vx,bullet.vy);game.update(.02);assert.equal(bullet.owner,'player');assert.ok(game.bullets.length>=1);if(type==='accelerator')assert.ok(Math.hypot(bullet.vx,bullet.vy)>speed);if(type==='slow_field')assert.ok(Math.hypot(bullet.vx,bullet.vy)<speed);if(type==='prism_splitter'){assert.equal(game.bullets.length,2);const clone=game.bullets.find(candidate=>candidate!==bullet)!;assert.equal(clone.owner,'player');assert.equal(clone.source,undefined);assert.equal(clone.orbitTime,undefined);}if(type==='bullet_orbiter')assert.equal(bullet.source,'bullet_orbiter');}
});

test('RICHOCHET enemy rounds get two wall bounces and do not alter player infinite ricochets',()=>{
  const game=new Game();game.start(1);game.player={x:500,y:500,hp:1};const bullet=game.addBullet(55,150,Math.PI,'enemy')!;bullet.source='ricochet_gunner';bullet.reflections=-2;game.update(.2);assert.equal(bullet.active,true);assert.equal(bullet.owner,'enemy');assert.ok(bullet.reflections>=-1);
});

test('MORTAR and sniper expose readable warnings before blast or fast shot',()=>{
  for(const type of ['mortar','tracking_sniper'] as const){const {game,enemy}=isolated(type,700,300);enemy.timer=0;game.update(.02);assert.ok(game.attackWarnings.some(w=>w.kind===(type==='mortar'?'MORTAR':'SNIPER')));}
});
test('HOPPER marks its landing, while FLANKER and ZIGZAG use non-linear approaches',()=>{
  const hopper=isolated('hopper',600,300);hopper.enemy.timer=0;hopper.game.player={x:360,y:300,hp:1};hopper.game.update(.02);assert.ok(hopper.game.attackWarnings.some(w=>w.kind==='HOPPER'));assert.equal(hopper.enemy.behavior?.mode,'windup');
  for(const type of ['flanker','zigzag'] as const){const {game,enemy}=isolated(type,600,300);game.player={x:300,y:300,hp:1};game.update(.1);assert.notEqual(enemy.y,300,`${type} should visibly deviate from a straight approach`);}
});

test('BURST, TRIPLE and RICOCHET gunners fire distinct enemy patterns',()=>{
  for(const [type,count] of [['burst_gunner',5],['triple_gunner',3],['ricochet_gunner',1]] as const){const {game,enemy}=isolated(type,700,300);game.debugInvincible=true;enemy.timer=0;game.update(.02);if(type==='ricochet_gunner'){const rounds=game.bullets.filter(b=>b.owner==='enemy');assert.equal(rounds.length,count,type);assert.equal(rounds[0].reflections,-2);continue;}const expectedWarning=type==='burst_gunner'?'BURST':'TRIPLE_GUNNER';assert.ok(game.attackWarnings.some(warning=>warning.kind===expectedWarning));assert.equal(game.bullets.filter(b=>b.owner==='enemy').length,0);for(let tick=0;tick<20;tick++)game.update(.1);assert.equal(game.bullets.filter(b=>b.owner==='enemy').length,count,type);}
});

test('ARC LAUNCHER telegraphs before a lob that fragments into bounded shards',()=>{
  const {game,enemy}=isolated('arc_launcher',700,300);enemy.timer=0;game.update(.02);assert.ok(game.attackWarnings.some(w=>w.kind==='ARC'));game.update(1.4);assert.ok(game.bullets.some(b=>b.source==='arc_launcher'));
});

test('MINE LAYER, WALL BUILDER and SHUTTER OPERATOR create warned temporary hazards',()=>{
  const mine=isolated('mine_layer',800,300);mine.game.stage=1;mine.game.floor=0;mine.enemy.timer=0;mine.game.player={x:300,y:300,hp:1};mine.game.update(.02);assert.ok(mine.game.enemyFields.some(field=>field.kind==='mine'&&(field.arm??0)>.9));
  const builder=isolated('wall_builder',800,300);builder.enemy.timer=.2;builder.game.player={x:400,y:300,hp:1};builder.game.update(.02);assert.ok(builder.game.enemyFields.some(field=>field.kind==='wall'));
  const shutter=isolated('shutter_operator',800,300);shutter.enemy.timer=0;shutter.game.update(.02);assert.ok(shutter.game.enemyFields.some(field=>field.kind==='shutter'));
});

test('DECOY PROJECTOR creates temporary non-colliding decoys, and BEACON calls one budgeted wave',()=>{
  const projector=isolated('decoy_projector');projector.enemy.timer=0;projector.game.update(.02);assert.equal(projector.game.enemyDecoys.length,2);assert.equal(projector.game.remaining,1);
  const beacon=isolated('reinforcement_beacon');beacon.game.enemies=[beacon.enemy];beacon.game.reinforcementQueue=[{types:['basic'],anchors:[{x:900,y:480}]}];beacon.game.update(.02);assert.ok(beacon.game.reinforcementWarning);assert.equal(beacon.game.remaining,2);
});

test('SQUAD COMMANDER boosts only nearby allies and TETHER GUARDS guard their paired line',()=>{
  const commander=isolated('squad_commander',600,300);commander.game.elapsed=5;commander.enemy.behavior!.lastAction=5;const ally:Enemy={x:650,y:300,type:'basic',hp:1,armor:false,radius:15,timer:10,hit:0};commander.game.enemies.push(ally);commander.game.update(.02);assert.ok((ally.behavior?.packBoost??0)>0);
  const tether=isolated('tether_guard',650,300);tether.game.player={x:500,y:300,hp:1};const mate:Enemy={x:350,y:300,type:'tether_guard',hp:2,armor:false,radius:16,timer:10,hit:0,squad:4};tether.enemy.squad=4;tether.game.enemies=[tether.enemy,mate];tether.game.update(.02);assert.equal(tether.game.deathCause,'TETHER LINE / 連結防衛線');
});
test('SHOCKWAVER exposes a safe sector before its ring resolves',()=>{
  const {game,enemy}=isolated('shockwaver',700,300);enemy.timer=0;game.player={x:300,y:300,hp:1};game.update(.02);const warning=game.attackWarnings.find(w=>w.kind==='SHOCKWAVE');assert.ok(warning);assert.ok(warning.angle!==undefined);warning.life=.01;const safe={x:enemy.x+Math.cos(warning.angle!)*70,y:enemy.y+Math.sin(warning.angle!)*70,hp:1};game.player=safe;game.update(.02);assert.notEqual(game.state,'dead');
});

test('ECHO STALKER follows the sampled player trail instead of current coordinates',()=>{
  const {game,enemy}=isolated('echo_stalker',500,300);game.player={x:300,y:300,hp:1};game.floorTime=3;(game as any).playerTrail=[{x:700,y:500,t:.2}];game.update(.1);assert.ok(enemy.y>300,'echo should head toward the stored lower position');
});

test('TETHER GUARD line shuts off when its partner is defeated',()=>{
  const {game,enemy}=isolated('tether_guard',650,300);game.player={x:500,y:300,hp:1};const partner:Enemy={x:350,y:300,type:'tether_guard',hp:0,armor:false,radius:16,timer:10,hit:0,squad:5};enemy.squad=5;game.enemies=[enemy,partner];game.update(.02);assert.equal(game.state,'playing');
});
test('TRACKING SNIPER follows the player during aim, then locks its shot line',()=>{
  const {game,enemy}=isolated('tracking_sniper',700,300);game.player={x:300,y:300,hp:1};enemy.timer=0;game.update(.02);const warning=game.attackWarnings.find(item=>item.kind==='SNIPER');assert.ok(warning);const original=warning.angle;game.player={x:300,y:500,hp:1};game.update(.2);assert.notEqual(warning.angle,original);game.update(.8);const locked=warning.angle;game.player={x:300,y:100,hp:1};game.update(.02);assert.equal(enemy.behavior?.mode,'cooldown');assert.equal(warning.angle,locked);
});
