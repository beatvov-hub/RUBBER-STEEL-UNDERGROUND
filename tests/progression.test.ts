import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine';
import { CHARACTERS, CONFIG } from '../src/data';
import { completeStage, migrateSave } from '../src/save';
import { balanceClusterTypes, floorFor, validateFloor } from '../src/world';

test('all 500 layouts are deterministic, valid and stage progression ends at the final clear',()=>{
  let clusteredFloors=0;
  for(let stage=1;stage<=50;stage++)for(let floor=1;floor<=10;floor++){
    const layout=floorFor(stage,floor);assert.equal(layout,floorFor(stage,floor));assert.deepEqual(validateFloor(layout),[],`${stage}:${floor}`);
    const clusters=[...layout.enemies.map(e=>e.cluster),...(layout.reinforcements??[]).flatMap(w=>w.clusterIds??[])].filter((id):id is number=>id!==undefined&&id!==null);
    if(clusters.length){clusteredFloors++;assert.equal(new Set(clusters).size,clusters.length/3,`${stage}:${floor} clusters must contain three enemies`);}
    if(floor===10){const allTypes=[...layout.enemies.map(e=>e.type),...(layout.reinforcements??[]).flatMap(w=>w.types)],count=allTypes.length,previous=floorFor(stage,9),previousCount=previous.enemies.length+(previous.reinforcements??[]).reduce((sum,w)=>sum+w.types.length,0);assert.ok(count>=previousCount,`${stage}:10 boss floor should not have fewer enemies than floor 9`);if(stage>=21){assert.equal(count,previousCount+3,`${stage}:late boss floor should add a three-enemy support wave`);const support=allTypes.filter(type=>type!=='boss');assert.ok(support.filter(type=>type==='armored').length>=Math.ceil(support.length*.5),`${stage}:late boss floor should field at least half armored support`);}}
  }
  assert.ok(clusteredFloors>100,`cluster opportunities should recur across the 500-floor campaign, got ${clusteredFloors}`);
  const g=new Game();g.start(50);for(let floor=0;floor<10;floor++){g.enemies=[];g.reinforcementQueue=[];g.reinforcementWarning=undefined;g.player={...g.exit,hp:1};g.update(CONFIG.fixedStep);if(g.state==='choice')g.choose(g.choices[0]);}assert.equal(g.state,'won');
});
test('late high-density floor nines offer three recurring TRIPLE cluster opportunities',()=>{
  for(let stage=41;stage<=50;stage++){
    const floor=floorFor(stage,9),ids=[...floor.enemies.map(e=>e.cluster),...(floor.reinforcements??[]).flatMap(w=>w.clusterIds??[])].filter((id):id is number=>id!==undefined&&id!==null);
    assert.equal(new Set(ids).size,3,`stage ${stage} floor 9 should contain three three-enemy clusters`);
  }
});
test('TRIPLE clusters pair at least two unarmored targets without changing floor composition',()=>{
  const sample=['armored','armored','armored','basic','shooter','armored','armored','basic'] as const;
  const balanced=balanceClusterTypes([...sample],0);assert.deepEqual([...sample],['armored','armored','armored','basic','shooter','armored','armored','basic']);
  assert.ok(balanced.slice(0,3).filter(type=>type==='armored').length<=1);
  for(const type of ['basic','shooter','armored','boss'] as const)assert.equal(balanced.filter(value=>value===type).length,sample.filter(value=>value===type).length);
  for(let stage=1;stage<=50;stage++)for(let floorNumber=1;floorNumber<=10;floorNumber++){
    const floor=floorFor(stage,floorNumber),spawns=[...floor.enemies,...(floor.reinforcements??[]).flatMap(w=>w.types.map((type,index)=>({type,x:w.anchors[index].x,y:w.anchors[index].y,cluster:w.clusterIds?.[index]??undefined})))];
    const before=Object.fromEntries(['basic','shooter','armored','boss'].map(type=>[type,spawns.filter(e=>e.type===type).length]));
    const ids=new Set(spawns.map(e=>e.cluster).filter((id):id is number=>id!==undefined));
    for(const id of ids){const members=spawns.filter(e=>e.cluster===id);assert.equal(members.length,3,`${stage}:${floorNumber} cluster ${id} size`);assert.ok(members.filter(e=>e.type==='armored').length<=1,`${stage}:${floorNumber} cluster ${id} should leave two targets vulnerable to TRIPLE`);}
    const after=Object.fromEntries(['basic','shooter','armored','boss'].map(type=>[type,spawns.filter(e=>e.type===type).length]));assert.deepEqual(after,before,`${stage}:${floorNumber} clustering must preserve the floor's enemy composition`);
  }
});
test('legacy save migrates progress, settings and unlock thresholds',()=>{
  const old=migrateSave({version:1,reachedStage:21,muted:true,bestSeconds:85,deaths:4});
  assert.equal(old.reachedStage,21);assert.equal(old.completedStages.length,20);assert.deepEqual(old.unlocked,['standard','fire','ice']);assert.equal(old.settings.master,0);assert.equal(old.bestByStage[1],85);
  const finished=completeStage(old,30,125);assert.equal(finished.reachedStage,31);assert.ok(finished.unlocked.includes('thunder'));assert.equal(finished.bestByStage[30],125);
  assert.equal(completeStage(finished,30,160).bestByStage[30],125);
  const prototypeWinner=migrateSave({version:1,reachedStage:1,bestSeconds:91});assert.deepEqual(prototypeWinner.completedStages,[1]);assert.equal(prototypeWinner.reachedStage,2);
});
test('character selection changes speed and elemental hits never bypass intact armor',()=>{
  const standard=new Game();standard.start(1,'standard');standard.enemies=[];standard.update(1,{x:1,y:0});
  const fire=new Game();fire.start(1,'fire');fire.enemies=[];fire.update(1,{x:1,y:0});
  assert.ok(standard.player.x>fire.player.x);assert.equal(fire.player.hp,CHARACTERS.fire.hp);
  fire.enemies=[{x:350,y:240,hp:1,armor:false,radius:15,type:'basic',timer:3,hit:0},{x:390,y:240,hp:1,armor:true,radius:15,type:'armored',timer:3,hit:0}];
  fire.player={x:220,y:515,hp:1};fire.addBullet(320,240,0,'player');fire.update(.1);
  assert.ok(fire.enemies[0].hp<=0);assert.equal(fire.enemies[1].hp,1);assert.equal(fire.enemies[1].armor,true);
});
test('collapse warns then persists and kills contact; moving wall activates after warning',()=>{
  const g=new Game();g.start(21);const index=Array.from({length:10},(_,i)=>i).find(i=>floorFor(21,i+1).hazards.some(h=>h.type==='collapse'))!;
  assert.ok(index>=0);g.floor=index;g.loadFloor();const collapse=g.layout.hazards.find(h=>h.type==='collapse')!;
  g.floorTime=(collapse.period??12)-collapse.warningSeconds+.1;assert.ok(g.hazards.find(h=>h.source===collapse)?.warning);
  g.player={x:collapse.rect.x+collapse.rect.w/2,y:collapse.rect.y+collapse.rect.h/2,hp:1};g.floorTime=(collapse.period??12)-.01;g.update(.02);
  assert.equal(g.state,'dead');assert.match(g.deathCause,/FLOOR COLLAPSE/);assert.ok(g.hazards.find(h=>h.source===collapse)?.active);
  const m=new Game();m.start(11);const i=Array.from({length:10},(_,f)=>f).find(f=>floorFor(11,f+1).hazards.some(h=>h.type==='moving_wall'))!;assert.ok(i>=0);m.floor=i;m.loadFloor();const wall=m.layout.hazards.find(h=>h.type==='moving_wall')!;
  assert.equal(m.hazards.find(h=>h.source===wall)?.active,false);m.floorTime=wall.warningSeconds+.01;assert.equal(m.hazards.find(h=>h.source===wall)?.active,true);
});
test('ability cooldown, radius and coolant alter intended values while rounds remain active',()=>{
  const g=new Game();g.start();g.enemies=[];g.abilities=['trigger','mass','coolant'];g.weapon='heavy';g.cooldown=0;g.shoot({x:850,y:170});
  assert.ok(Math.abs(g.cooldown-.72)<.001);const b=g.bullets[0];assert.equal(b.radius,10);const initial=Math.hypot(b.vx,b.vy);
  g.reflect(b,'x');assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-initial*.9)<.001);assert.equal(b.active,true);
});
test('area bosses have distinct profiles and intact armor reflects the opening shot',()=>{
  const names=new Set<string>();for(const stage of [10,20,30,40,50]){
    const g=new Game();g.start(stage);g.floor=9;g.loadFloor();names.add(g.bossSpec.name);
    const boss=g.enemies.find(e=>e.type==='boss')!;assert.ok(boss);assert.equal(boss.hp,g.bossSpec.hp);assert.equal(boss.armor,true);
    g.enemies=[boss];g.player={x:g.entry.x,y:g.entry.y,hp:1};const b=g.addBullet(boss.x-40,boss.y,0,'player')!;g.update(.02);
    assert.equal(boss.hp,g.bossSpec.hp);assert.equal(boss.armor,false);assert.ok(b.active);
  }assert.equal(names.size,5);
});
test('non-tutorial elite bosses add a warned two-shot fan while area bosses keep their profile',()=>{
  const fired=(stage:number)=>{const g=new Game();g.start(stage);g.floor=9;g.loadFloor();const boss=g.enemies.find(e=>e.type==='boss')!;g.enemies=[boss];boss.timer=0;g.update(CONFIG.fixedStep);return g.bullets.filter(b=>b.owner==='enemy').length;};
  assert.equal(fired(1),1);assert.equal(fired(41),2);assert.equal(fired(50),3);
});
test('the first-stage reflector boss teaches the armor rule on floor ten',()=>{
  const g=new Game();g.start(1);g.floor=9;g.loadFloor();const boss=g.enemies.find(e=>e.type==='boss')!;assert.equal(boss.armor,true);
  const b=g.addBullet(boss.x-40,boss.y,0,'player')!;g.player={x:g.entry.x,y:g.entry.y,hp:1};g.update(.02);assert.equal(boss.hp,g.bossSpec.hp);assert.equal(boss.armor,false);assert.ok(b.active);
});
test('debug invincibility is opt-in and does not change normal damage',()=>{
  const g=new Game();g.start();g.debugInvincible=true;g.die('TEST');assert.equal(g.state,'playing');assert.equal(g.player.hp,1);
  g.debugInvincible=false;g.die('TEST');assert.equal(g.state,'dead');
});
