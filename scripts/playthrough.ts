import { Game, circleRect } from '../src/engine';
import { CONFIG, type CharacterId, type Vec } from '../src/data';
import { hazardEnvelope } from '../src/world';
// A deterministic pilot using ordinary movement/shooting. No HP, enemy, or bullet overrides.
const stage=Number(process.argv[2]??1),character=(process.argv[3]??'standard') as CharacterId;const game = new Game(); game.start(stage,character);
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
function free(p:Vec,r=15){const b=game.layout.bounds;return p.x>b.x+r&&p.y>b.y+r&&p.x<b.x+b.w-r&&p.y<b.y+b.h-r&&![...game.layout.walls,...game.layout.hazards.map(h=>hazardEnvelope(h))].some(w=>circleRect(p,r,w));}
function visible(p:Vec,q:Vec){const d=dist(p,q);for(let t=0;t<d;t+=8){if(!free({x:p.x+(q.x-p.x)*t/d,y:p.y+(q.y-p.y)*t/d},9))return false;}return true;}
function route(goal:Vec){const cell=12;const sx=Math.round(game.player.x/cell),sy=Math.round(game.player.y/cell);const queue=[[sx,sy]],seen=new Set([`${sx},${sy}`]);const parent=new Map<string,string>();let best=`${sx},${sy}`,bestDist=Infinity;
for(let i=0;i<queue.length;i++){const[x,y]=queue[i],key=`${x},${y}`;const d=dist({x:x*cell,y:y*cell},goal);if(d<bestDist){bestDist=d;best=key;}if(d<22)break;for(const[nx,ny]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const k=`${nx},${ny}`;if(!seen.has(k)&&free({x:nx*cell,y:ny*cell})){seen.add(k);parent.set(k,key);queue.push([nx,ny]);}}}
const start=`${sx},${sy}`,path:string[]=[];let at=best;while(at!==start&&parent.has(at)){path.push(at);at=parent.get(at)!;}path.reverse();const waypoint=path[Math.min(5,path.length-1)]??start;const point=waypoint.split(',').map(Number);return{x:point[0]*cell,y:point[1]*cell};}
let deaths=0, lastFloor=-1, floorTime=0,shotClock=2;const previousEnemies=new Map<object,Vec>();const causes=new Map<string,number>();
for(let tick=0;tick<120*1500;tick++){
 if(game.state==='won'||game.state==='stage-clear'){console.log(`PASS: STAGE ${stage} / ${character}, 10 floors cleared with ordinary controls, ${deaths} retries, ${game.shots} shots, ${game.reflectionCount} rebounds.`);process.exit(0);}
 if(game.state==='dead'){deaths++;causes.set(game.deathCause,(causes.get(game.deathCause)??0)+1);if(deaths<=3)console.log('DEATH',deaths,game.floor+1,game.deathCause,'time',floorTime.toFixed(1),'shots',game.shots,'remaining',game.remaining,'pos',Math.round(game.player.x),Math.round(game.player.y),game.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,x:Math.round(e.x),y:Math.round(e.y),armor:e.armor})));if(deaths>60)break;game.retry();floorTime=0;shotClock=2;}
 if(game.state==='choice'){game.choose(game.choices.find(x=>x==='slow')??game.choices[0]);}
 if(game.floor!==lastFloor){lastFloor=game.floor;floorTime=0;shotClock=2;console.log(`Pilot entered floor ${lastFloor+1}`);}
 floorTime+=CONFIG.fixedStep;shotClock+=CONFIG.fixedStep;if(floorTime>140){console.log('Pilot timed out',game.floor+1,game.remaining,game.player,game.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,x:Math.round(e.x),y:Math.round(e.y)})),'route',route(game.enemies.find(e=>e.hp>0)??game.exit));break;}
 const live=game.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(a,game.player)-dist(b,game.player));const enemy=live.find(e=>visible(game.player,e))??live[0];const goal=enemy??game.exit;let aim:Vec=goal;
 if(enemy){const old=previousEnemies.get(enemy);if(old){const flight=dist(enemy,game.player)/285;aim={x:enemy.x+(enemy.x-old.x)/CONFIG.fixedStep*flight*.8,y:enemy.y+(enemy.y-old.y)/CONFIG.fixedStep*flight*.8};}previousEnemies.set(enemy,{x:enemy.x,y:enemy.y});}
 const waypoint=visible(game.player,goal)?goal:route(goal);const desired={x:waypoint.x-game.player.x,y:waypoint.y-game.player.y};const len=Math.max(1,Math.hypot(desired.x,desired.y));desired.x/=len;desired.y/=len;
 let best={x:0,y:0},bestScore=-Infinity;
 for(let k=-1;k<16;k++){const m=k<0?{x:0,y:0}:{x:Math.cos(k*Math.PI/8),y:Math.sin(k*Math.PI/8)};let score=0;const future={x:game.player.x+m.x*205*.12,y:game.player.y+m.y*205*.12};if(!free(future))continue;
 if(!enemy||!visible(game.player,enemy)||dist(enemy,game.player)>330)score=(m.x*desired.x+m.y*desired.y)*2;
 else if(dist(enemy,game.player)<75)score=-(m.x*desired.x+m.y*desired.y)*2;
 else score=1-Math.abs(m.x*desired.x+m.y*desired.y);
 if(k<0)score-=2;
 for(const e of live){const d=dist(future,e);score-=Math.max(0,120-d)/9;}
 for(const b of game.bullets){if(!b.armed)continue;const rx=b.x-game.player.x,ry=b.y-game.player.y,vx=b.vx-m.x*205,vy=b.vy-m.y*205;const t=Math.max(0,Math.min(.5,-(rx*vx+ry*vy)/(vx*vx+vy*vy)));const d=Math.hypot(rx+vx*t,ry+vy*t);score-=Math.max(0,52-d)/4;}
 if(score>bestScore){bestScore=score;best=m;}}
 const rounds=game.bullets.filter(b=>b.owner==='player').length;const shouldFire=Boolean(enemy&&visible(game.player,aim)&&shotClock>1.1&&rounds<8);
 const shots=game.shots;game.update(CONFIG.fixedStep,best,aim,shouldFire);if(game.shots>shots)shotClock=0;
}
console.log(`Pilot incomplete: floor ${game.floor+1}, deaths ${deaths}, state ${game.state}`,Object.fromEntries(causes));process.exit(1);
