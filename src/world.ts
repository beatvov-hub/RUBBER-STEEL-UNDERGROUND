import { CONFIG, FLOORS, type EnemyType, type Floor, type Hazard, type Rect, type Vec } from './data';

export const AREA_NAMES = ['ENTRY SECTOR', 'INDUSTRIAL SECTOR', 'EXPERIMENT SECTOR', 'CONTAINMENT FAILURE', 'RUBBER STEEL CORE'] as const;
export type Stage = { number: number; area: number; areaName: string; name: string; seed: number; palette: { floor: string; accent: string; light: string }; boss: 'elite' | 'area' | 'final' };
export const BOSS_ARCHETYPES = [
  {name:'THE GATEKEEPER',hp:8,speed:28,cooldown:3.4,shots:1},
  {name:'THE FORGE',hp:9,speed:20,cooldown:3.6,shots:2},
  {name:'THE PRISM',hp:8,speed:34,cooldown:3.1,shots:2},
  {name:'THE WARDEN',hp:9,speed:29,cooldown:2.9,shots:2},
  {name:'RUBBER STEEL HEART',hp:11,speed:30,cooldown:3.2,shots:3},
] as const;
const AREAS = [
  { floor: '#3b4a55', accent: '#a4c0bd', light: '#b9d8d8' },
  { floor: '#4a4848', accent: '#d5ad82', light: '#e3c09b' },
  { floor: '#3f4653', accent: '#a6bde3', light: '#b8caec' },
  { floor: '#50444a', accent: '#d49a9c', light: '#e5b7aa' },
  { floor: '#343e4b', accent: '#b9b4df', light: '#d5caf1' },
];
const CHAPTERS = [
  ['CHECKPOINT','LOWER ACCESS','REFLECTION WING','SECURITY LOOP','VISITOR SHAFT','BARRIER LINE','SERVICE DECK','GATEHOUSE','ENTRY VAULT','THE FIRST LOCK'],
  ['PRESS HALL','FOUNDRY','ASSEMBLY','HEAT EXCHANGE','SHUTTER LINE','CONVEYOR','STAMPING BAY','ALLOY WORKS','FURNACE EDGE','THE FORGE'],
  ['LENS ARRAY','CONTROL GROUP','TEST CHAMBER','PHASE LAB','COLD STORAGE','ECHO ROOM','OBSERVATION','VOID SAMPLE','BREAK POINT','THE EXPERIMENT'],
  ['RED ALERT','BULKHEAD','BREACH ZONE','BLACKOUT','SEAL FAILURE','RETURN SHAFT','EVACUATION','OVERRUN','LAST DOOR','THE CONTAINMENT'],
  ['ANOMALY','INNER RING','SILENT ARRAY','DEEP FIELD','RECURSION','REFRACTION','HALO CORE','IMPOSSIBLE ROOM','FINAL APPROACH','RUBBER STEEL HEART'],
];
export const STAGES: Stage[] = Array.from({ length: 50 }, (_, i) => {
  const area = Math.floor(i / 10), number = i + 1;
  return { number, area, areaName: AREA_NAMES[area], name: CHAPTERS[area][i % 10], seed: seedOf(number, 0, 0), palette: AREAS[area], boss: number === 50 ? 'final' : number % 10 === 0 ? 'area' : 'elite' };
});
export function seedOf(stage: number, floor: number, salt = 0): number {
  let x = (0x9e3779b9 ^ Math.imul(stage, 0x85ebca6b) ^ Math.imul(floor, 0xc2b2ae35) ^ salt) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return x >>> 0;
}
function random(seed: number) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 0x100000000; }; }
const rect = (x:number,y:number,w:number,h:number):Rect => ({x,y,w,h});
const BOUNDS = rect(48,48,1024,544);
const SMALL = rect(140,75,840,490);
const TEMPLATES: Record<string, (b:Rect, variant:number)=>Rect[]> = {
  SMALL_ROOM: () => [], OPEN_ROOM: () => [],
  PILLAR_ROOM: (_b,v) => [rect(395+v,210,64,64),rect(685-v,390,64,64)],
  CROSS_ROOM: (_b,v) => [rect(420+v,190,72,150),rect(690-v,355,72,150)],
  NARROW_ROOM: (_b,v) => [rect(390+v,135,58,285),rect(720-v,300,58,235)],
  DOUBLE_ROOM: (_b,v) => [rect(550+v,48,62,235),rect(550+v,385,62,207)],
  CORRIDOR_ROOM: (_b,v) => [rect(320+v,160,250,58),rect(625-v,410,250,58)],
  RING_ROOM: (_b,v) => [rect(460+v,205,66,64),rect(590,205,66,64),rect(460+v,360,66,64),rect(590,360,66,64)],
  SPLIT_ROOM: (_b,v) => [rect(400+v,48,62,200),rect(400+v,345,62,247),rect(730-v,160,62,260)],
  MAZE_ROOM: (_b,v) => [rect(300+v,120,50,300),rect(520,370,50,200),rect(730-v,100,50,220)],
  LARGE_ARENA: (_b,v) => [rect(315+v,185,62,62),rect(315+v,390,62,62),rect(785-v,185,62,62),rect(785-v,390,62,62)],
};
export const TEMPLATE_NAMES = Object.keys(TEMPLATES);
const circleRect = (p:Vec,r:number,w:Rect) => Math.hypot(p.x-Math.max(w.x,Math.min(p.x,w.x+w.w)),p.y-Math.max(w.y,Math.min(p.y,w.y+w.h))) < r;
export function hazardEnvelope(h:Hazard):Rect {const s=h.span??0;return {x:h.rect.x-(h.axis==='x'?s:0),y:h.rect.y-(h.axis==='y'?s:0),w:h.rect.w+(h.axis==='x'?s*2:0),h:h.rect.h+(h.axis==='y'?s*2:0)};}
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function clear(p:Vec, radius:number, b:Rect, walls:Rect[]) {
  return p.x>=b.x+radius && p.y>=b.y+radius && p.x<=b.x+b.w-radius && p.y<=b.y+b.h-radius && walls.every(w=>!circleRect(p,radius,w));
}
function entryOf(b:Rect):Vec { return {x:b.x+45,y:b.y+b.h-45}; }
function exitOf(b:Rect):Vec { return {x:b.x+b.w-45,y:b.y+45}; }
export function reachable(floor:Floor, blocked:Rect[]=[]):Set<string> {
  const grid=12,r=CONFIG.playerRadius+2,b=floor.bounds,walls=[...floor.walls,...blocked];
  const start=entryOf(b), sx=Math.round(start.x/grid),sy=Math.round(start.y/grid), key=(x:number,y:number)=>`${x},${y}`;
  if(!clear(start,r,b,walls))return new Set();
  const visited=new Set([key(sx,sy)]), queue:[[number,number]]|number[][]=[[sx,sy]];
  for(let i=0;i<queue.length;i++){const[x,y]=queue[i];for(const[nx,ny]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
    const k=key(nx,ny);if(!visited.has(k)&&clear({x:nx*grid,y:ny*grid},r,b,walls)){visited.add(k);queue.push([nx,ny]);}
  }}
  return visited;
}
export function validateFloor(floor:Floor):string[] {
  const b=floor.bounds, errors:string[]=[],points=[{label:'ENTRY',p:entryOf(b)},{label:'EXIT',p:exitOf(b)},...floor.enemies.map((e,i)=>({label:`ENEMY ${i}`,p:e}))];
  for(const {label,p} of points)if(!clear(p,CONFIG.playerRadius+2,b,floor.walls))errors.push(`${label} overlaps steel or boundary`);
  const seen=reachable(floor), has=(p:Vec)=>seen.has(`${Math.round(p.x/12)},${Math.round(p.y/12)}`);
  for(const {label,p} of points)if(!has(p))errors.push(`${label} unreachable`);
  if(!floor.enemies.length)errors.push('no enemies');
  if(floor.enemies.length>18)errors.push('enemy density too high');
  const floorArea=b.w*b.h,wallArea=floor.walls.reduce((sum,w)=>sum+w.w*w.h,0);
  if(wallArea/floorArea>.18)errors.push('reflective obstruction density too high');
  for(let i=0;i<floor.hazards.length;i++){
    const h=floor.hazards[i];if(h.warningSeconds<1.5)errors.push(`HAZARD ${i} warning too short`);
    const envelope=hazardEnvelope(h);
    if(circleRect(entryOf(b),45,envelope)||circleRect(exitOf(b),45,envelope))errors.push(`HAZARD ${i} blocks gate`);
    if(floor.enemies.some(e=>circleRect(e,24,envelope)))errors.push(`HAZARD ${i} overlaps enemy`);
    if(floor.walls.some(w=>overlaps(w,envelope)))errors.push(`HAZARD ${i} overlaps steel`);
    if(envelope.x<b.x+20||envelope.x+envelope.w>b.x+b.w-20||envelope.y<b.y+20||envelope.y+envelope.h>b.y+b.h-20)errors.push(`HAZARD ${i} leaves room`);
    if(h.type==='moving_wall'&&(!h.period||h.period<4||!h.span||h.span>80))errors.push(`HAZARD ${i} motion unsafe`);
  }
  const collapsed=floor.hazards.filter(h=>h.type==='collapse').map(h=>h.rect);
  if(collapsed.length){const after=reachable(floor,collapsed);if(!after.has(`${Math.round(exitOf(b).x/12)},${Math.round(exitOf(b).y/12)}`))errors.push('collapsed floor seals route');for(let i=0;i<floor.enemies.length;i++)if(!after.has(`${Math.round(floor.enemies[i].x/12)},${Math.round(floor.enemies[i].y/12)}`))errors.push(`collapsed floor isolates enemy ${i}`);}
  const moving=floor.hazards.filter(h=>h.type==='moving_wall').map(hazardEnvelope);
  if(moving.length){const after=reachable(floor,[...collapsed,...moving]);if(!after.has(`${Math.round(exitOf(b).x/12)},${Math.round(exitOf(b).y/12)}`))errors.push('moving wall can seal route');for(let i=0;i<floor.enemies.length;i++)if(!after.has(`${Math.round(floor.enemies[i].x/12)},${Math.round(floor.enemies[i].y/12)}`))errors.push(`moving wall isolates enemy ${i}`);}
  return errors;
}
function candidate(stage:number,number:number,attempt:number):Floor {
  const info=STAGES[stage-1],area=info.area,seed=seedOf(stage,number,attempt),rng=random(seed);
  const elite=number===10,roomNames=elite?['LARGE_ARENA','OPEN_ROOM','RING_ROOM']:area===0?TEMPLATE_NAMES.slice(0,7):TEMPLATE_NAMES;
  const template=roomNames[Math.floor(rng()*roomNames.length)],bounds=area===0&&number<4&&template==='SMALL_ROOM'?SMALL:BOUNDS;
  const variant=Math.round((rng()-.5)*44),walls=TEMPLATES[template](bounds,variant);
  const hazards:Hazard[]=[];
  const viable=(h:Hazard)=>{const e=hazardEnvelope(h);return !walls.some(w=>overlaps(w,e))&&!circleRect(entryOf(bounds),55,e)&&!circleRect(exitOf(bounds),55,e)&&e.x>bounds.x+22&&e.y>bounds.y+22&&e.x+e.w<bounds.x+bounds.w-22&&e.y+e.h<bounds.y+bounds.h-22;};
  if(area>=1&&number>=3){
    for(const position of [rect(580,150,42,82),rect(840,175,42,82),rect(280,250,42,82)]){
      const h:Hazard={type:'moving_wall',rect:position,warningSeconds:2,period:7+area,phase:rng()*2*Math.PI,span:area>=3?50:40,axis:'y'};
      if(viable(h)){hazards.push(h);break;}
    }
  }
  if(area>=2&&number>=2){
    const slots=[rect(330,285,62,62),rect(780,300,62,62),rect(550,420,62,62),rect(910,420,62,62),rect(250,400,62,62)];
    for(const slot of slots){
      const h:Hazard={type:'collapse',rect:slot,warningSeconds:4+area,period:11+Math.floor(rng()*5),phase:3+rng()*4};
      if(viable(h)&&hazards.every(existing=>!overlaps(hazardEnvelope(existing),h.rect)))hazards.push(h);
      if(hazards.filter(x=>x.type==='collapse').length>=Math.min(1+Math.floor(area/2),3))break;
    }
  }
  const enemyCount=elite?1+Math.min(4,area):Math.min(3+Math.floor(number/3)+area,10);
  const enemies:Floor['enemies']=[];
  const pool:EnemyType[]=area===0?['basic','basic','basic','shooter','armored']:['basic','basic','shooter','armored','armored'];
  for(let i=0;i<enemyCount;i++){
    const type=elite&&i===0?'boss':pool[Math.floor(rng()*pool.length)];
    for(let tries=0;tries<120;tries++){
      const x=bounds.x+90+rng()*(bounds.w-180),y=bounds.y+70+rng()*(bounds.h-140),p={x,y};
      if(Math.hypot(x-entryOf(bounds).x,y-entryOf(bounds).y)<180||Math.hypot(x-exitOf(bounds).x,y-exitOf(bounds).y)<65)continue;
      if(!clear(p,type==='boss'?36:21,bounds,walls)||enemies.some(e=>Math.hypot(e.x-x,e.y-y)<65)||hazards.some(h=>circleRect(p,28,hazardEnvelope(h))))continue;
      enemies.push({type,x:Math.round(x),y:Math.round(y)});break;
    }
  }
  return {name:elite?(info.boss==='final'?'FINAL TEST':info.boss==='area'?'AREA CORE':'ELITE CHAMBER'):`${info.name} / ${String(number).padStart(2,'0')}`,
    template,bounds,walls,enemies,hazards,seed,stage,number};
}
function safeFloor(stage:number,number:number):Floor {
  const info=STAGES[stage-1],elite=number===10;
  const hazards:Hazard[]=[];
  if(stage>=11&&number>=3)hazards.push({type:'moving_wall',rect:rect(580,150,42,82),warningSeconds:2,period:8,phase:1,span:40,axis:'y'});
  if(stage>=21&&number>=2)hazards.push({type:'collapse',rect:rect(330,285,62,62),warningSeconds:6,period:14,phase:4});
  return {name:elite?'ELITE CHAMBER':`${info.name} / SAFE CHAMBER`,template:'OPEN_ROOM',bounds:BOUNDS,walls:[],
    enemies:elite?[{type:'boss',x:820,y:180}]:[{type:'basic',x:790,y:190},{type:stage>=21?'armored':'basic',x:620,y:330}],hazards,seed:seedOf(stage,number,999),stage,number};
}
const cache=new Map<string,Floor>();
export function floorFor(stage:number,number:number):Floor {
  if(!Number.isInteger(stage)||stage<1||stage>50||!Number.isInteger(number)||number<1||number>10)throw new RangeError('Invalid stage or floor');
  if(stage===1)return FLOORS[number-1];
  const key=`${stage}:${number}`;let floor=cache.get(key);if(floor)return floor;
  for(let attempt=0;attempt<8;attempt++){floor=candidate(stage,number,attempt);if(!validateFloor(floor).length){cache.set(key,floor);return floor;}}
  floor=safeFloor(stage,number);const errors=validateFloor(floor);if(errors.length)throw new Error(`Safe floor ${key} failed: ${errors.join(', ')}`);
  cache.set(key,floor);return floor;
}
