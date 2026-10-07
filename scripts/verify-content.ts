import { floorFor, STAGES, TEMPLATE_NAMES, validateFloor } from '../src/world';

let failures=0, fallback=0, hazards=0, armored=0;
const areaHazards=Array.from({length:5},()=>({moving:0,collapse:0}));
console.log('STAGE/FLOOR | ROOM TYPE      | ENEMIES | ARMORED | HAZARDS | FLOOR SIZE | SEED       | STATUS');
for(const stage of STAGES)for(let number=1;number<=10;number++){
  try {
    const floor=floorFor(stage.number,number),errors=validateFloor(floor);
    if(!TEMPLATE_NAMES.includes(floor.template))errors.push('unknown room type');
    if(floor.name.includes('SAFE CHAMBER'))fallback++;
    if(number===10&&!floor.enemies.some(e=>e.type==='boss'))errors.push('elite floor lacks boss');
    for(const h of floor.hazards)areaHazards[stage.area][h.type==='moving_wall'?'moving':'collapse']++;
    const armor=floor.enemies.filter(e=>e.type==='armored').length;
    hazards+=floor.hazards.length;armored+=armor;
    if(errors.length)failures++;
    console.log(`${String(stage.number).padStart(2,'0')}/${String(number).padStart(2,'0')}       | ${floor.template.padEnd(14)} | ${String(floor.enemies.length).padStart(7)} | ${String(armor).padStart(7)} | ${String(floor.hazards.length).padStart(7)} | ${String(floor.bounds.w).padStart(4)}×${String(floor.bounds.h).padEnd(4)} | ${String(floor.seed??stage.seed).padStart(10)} | ${errors.length?errors.join('; '):'OK'}`);
  } catch(error){failures++;console.error(`STAGE ${stage.number} FLOOR ${number}: ${String(error)}`);}
}
for(let area=1;area<5;area++){
  if(areaHazards[area].moving<10){failures++;console.error(`AREA ${area+1}: insufficient moving walls`);}
  if(area>=2&&areaHazards[area].collapse<10){failures++;console.error(`AREA ${area+1}: insufficient collapse floors`);}
}
console.log(`500 floors checked / errors=${failures} / fallback=${fallback} / armor=${armored} / hazards=${hazards}`);
if(failures)process.exitCode=1;
