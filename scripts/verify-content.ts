import { enemyTargetFor, floorFor, seedOf, STAGES, TEMPLATE_NAMES, validateFloor } from '../src/world';

const verbose=process.argv.includes('--verbose');
const profile=process.argv.includes('--profile');
let failures=0, fallback=0, hazards=0, armored=0, initialArmored=0, totalEnemies=0, maxInitial=0, waves=0, clusters=0;
const areaHazards=Array.from({length:5},()=>({moving:0,collapse:0}));
const floorProfiles=Array.from({length:5},()=>Array.from({length:10},()=>({enemies:0,armored:0,shooters:0,basic:0,bosses:0,clusters:0,moving:0,collapse:0,rooms:{} as Record<string,number>})));
const stageTotals=Array.from({length:50},()=>0);
const expectedStageTotals=[59,...Array(9).fill(63),...Array(10).fill(100),...Array(10).fill(145),...Array(10).fill(198),...Array(10).fill(258)];
if(verbose)console.log('STAGE/FLOOR | ROOM TYPE      | ENEMIES | ARMORED | HAZARDS | FLOOR SIZE | SEED       | STATUS');
for(const stage of STAGES)for(let number=1;number<=10;number++){
  try {
    const floor=floorFor(stage.number,number),errors=validateFloor(floor);
    if(!TEMPLATE_NAMES.includes(floor.template))errors.push('unknown room type');
    if(floor.enemies.length>12)errors.push(`initial enemy cap exceeded: ${floor.enemies.length}/12`);
    if(stage.number===1&&number<=2&&floor.enemies.length!==number)errors.push('tutorial enemy count changed');
    if(floor.name.includes('SAFE CHAMBER')||floor.seed===seedOf(stage.number,number,999))fallback++;
    if(number===10&&!floor.enemies.some(e=>e.type==='boss'))errors.push('elite floor lacks boss');
    const total=floor.enemies.length+(floor.reinforcements??[]).reduce((n,w)=>n+w.types.length,0);
    totalEnemies+=total;stageTotals[stage.number-1]+=total;maxInitial=Math.max(maxInitial,floor.enemies.length);waves+=(floor.reinforcements??[]).length;
    const floorProfile=floorProfiles[stage.area][number-1],types=[...floor.enemies.map(e=>e.type),...(floor.reinforcements??[]).flatMap(w=>w.types)];
    floorProfile.enemies+=types.length;floorProfile.armored+=types.filter(type=>type==='armored').length;floorProfile.shooters+=types.filter(type=>type==='shooter').length;floorProfile.basic+=types.filter(type=>type==='basic').length;floorProfile.bosses+=types.filter(type=>type==='boss').length;floorProfile.rooms[floor.template]=(floorProfile.rooms[floor.template]??0)+1;
    const clusterIds=[...floor.enemies.map(e=>e.cluster),...(floor.reinforcements??[]).flatMap(w=>w.clusterIds??[])].filter((id):id is number=>id!==undefined&&id!==null);
    const uniqueClusters=new Set(clusterIds);clusters+=uniqueClusters.size;floorProfile.clusters+=uniqueClusters.size;
    if(floor.enemyTarget!==undefined&&total!==floor.enemyTarget)errors.push(`target count ${total}/${floor.enemyTarget}`);
    for(const h of floor.hazards){areaHazards[stage.area][h.type==='moving_wall'?'moving':'collapse']++;floorProfile[h.type==='moving_wall'?'moving':'collapse']++;}
    const armor=floor.enemies.filter(e=>e.type==='armored').length,totalArmor=types.filter(type=>type==='armored').length;
    hazards+=floor.hazards.length;armored+=totalArmor;initialArmored+=armor;
    if(errors.length)failures++;
    if(verbose||errors.length)console.log(`${String(stage.number).padStart(2,'0')}/${String(number).padStart(2,'0')}       | ${floor.template.padEnd(14)} | ${String(floor.enemies.length).padStart(7)} | ${String(armor).padStart(7)} | ${String(floor.hazards.length).padStart(7)} | ${String(floor.bounds.w).padStart(4)}×${String(floor.bounds.h).padEnd(4)} | ${String(floor.seed??stage.seed).padStart(10)} | ${errors.length?errors.join('; '):'OK'}`);
  } catch(error){failures++;console.error(`STAGE ${stage.number} FLOOR ${number}: ${String(error)}`);}
}
for(let area=1;area<5;area++){
  if(areaHazards[area].moving<10){failures++;console.error(`AREA ${area+1}: insufficient moving walls`);}
  if(area>=2&&areaHazards[area].collapse<10){failures++;console.error(`AREA ${area+1}: insufficient collapse floors`);}
}
for(let stage=0;stage<50;stage++){
  if(stageTotals[stage]!==expectedStageTotals[stage]){failures++;console.error(`STAGE ${String(stage+1).padStart(2,'0')}: expected ${expectedStageTotals[stage]} enemies, got ${stageTotals[stage]}`);}
  for(let floor=2;floor<=9;floor++)if(enemyTargetFor(stage+1,floor)<enemyTargetFor(stage+1,floor-1)){failures++;console.error(`STAGE ${String(stage+1).padStart(2,'0')}: enemy curve drops before the boss floor (${floor-1}→${floor})`);}
  if(verbose||stage===0||stage===9||stage===10||stage===19||stage===20||stage===29||stage===30||stage===39||stage===40||stage===49)console.log(`STAGE ${String(stage+1).padStart(2,'0')}: ${stageTotals[stage]} enemies`);
}
console.log(`500 floors checked / errors=${failures} / fallback=${fallback} / armored total=${armored} / armored initial=${initialArmored} / hazards=${hazards}`);
console.log(`TOTAL ENEMIES ${totalEnemies} / MAX INITIAL ${maxInitial} / REINFORCEMENT WAVES ${waves}`);
console.log(`THREE-ENEMY CLUSTERS ${clusters}`);
for(let area=0;area<5;area++)console.log(`AREA ${area+1}: stages ${area*10+1}-${area*10+10} / ${stageTotals.slice(area*10,area*10+10).reduce((a,b)=>a+b,0)} total`);
if(profile){
  console.log('DIFFICULTY PROFILE (10 stages pooled per area; enemy and hazard counts are per floor averages)');
  for(let area=0;area<5;area++)for(let floor=0;floor<10;floor++){
    const p=floorProfiles[area][floor],n=10,roomSummary=Object.entries(p.rooms).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([name,count])=>`${name}:${count}`).join(',');
    console.log(`AREA ${area+1} F${String(floor+1).padStart(2,'0')}: enemies ${(p.enemies/n).toFixed(1)} (basic ${(p.basic/n).toFixed(1)}, shooter ${(p.shooters/n).toFixed(1)}, armored ${(p.armored/n).toFixed(1)}, boss ${(p.bosses/n).toFixed(1)}); clusters ${(p.clusters/n).toFixed(1)}; hazards moving ${(p.moving/n).toFixed(1)}, collapse ${(p.collapse/n).toFixed(1)}; rooms ${roomSummary}`);
  }
}
if(failures)process.exitCode=1;
