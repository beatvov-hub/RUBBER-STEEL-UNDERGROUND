import { enemyDefinition } from '../definitions';
import type { EnemyBehaviorState } from '../state';
import type { EnemyType } from '../types';
import type { Enemy } from '../../engine';
import type { Rect, Vec } from '../../data';

export type EnemyMovementContext = {
  player: Vec;
  enemies: Enemy[];
  elapsed: number;
  dt: number;
  area: number;
  bossSpeed: number;
  walls: Rect[];
  isFree: (p: Vec, radius: number) => boolean;
  playerHistory?: (seconds:number)=>Vec|undefined;
};
export type EnemyMoveIntent = { velocity: Vec; ignoreWalls?: boolean };

const unit = (x: number, y: number): Vec => { const length = Math.max(.001, Math.hypot(x,y)); return {x:x/length,y:y/length}; };
const add = (a:Vec,b:Vec,scale=1):Vec => ({x:a.x+b.x*scale,y:a.y+b.y*scale});
const dist = (a:Vec,b:Vec) => Math.hypot(a.x-b.x,a.y-b.y);
function lineIntersectsRect(a:Vec,b:Vec,r:Rect) {
  let t0=0,t1=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const[p,q]of[[-dx,a.x-r.x],[dx,r.x+r.w-a.x],[-dy,a.y-r.y],[dy,r.y+r.h-a.y]]){
    if(Math.abs(p)<1e-8){if(q<0)return false;continue;}
    const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}
  }
  return t0<=t1;
}

function flankerVelocity(enemy:Enemy,context:EnemyMovementContext):Vec {
  const state=enemy.behavior!;
  const bearing=Math.atan2(enemy.y-context.player.y,enemy.x-context.player.x);
  if(state.flankSide===undefined){
    const scores=[-1,1].map(side=>{
      const angle=bearing+side*Math.PI*.62,target={x:context.player.x+Math.cos(angle)*145,y:context.player.y+Math.sin(angle)*145};
      const crowd=context.enemies.reduce((sum,other)=>other!==enemy&&other.hp>0?sum+Math.max(0,150-dist(target,other)):sum,0);
      return {side:side as -1|1,target,score:crowd+(context.isFree(target,enemy.radius)?0:10000)};
    }).sort((a,b)=>a.score-b.score);
    state.flankSide=scores[0].side;
  }
  const angle=bearing+state.flankSide*Math.PI*.62,target={x:context.player.x+Math.cos(angle)*145,y:context.player.y+Math.sin(angle)*145};
  if(!context.isFree(target,enemy.radius))return unit(context.player.x-enemy.x,context.player.y-enemy.y);
  return unit(target.x-enemy.x,target.y-enemy.y);
}

function dasherIntent(enemy:Enemy,context:EnemyMovementContext):EnemyMoveIntent {
  const state=enemy.behavior!;state.mode??='approach';state.modeTime??=0;
  if(state.mode==='approach'){
    if(enemy.timer<=0&&dist(enemy,context.player)<330){state.mode='windup';state.modeTime=.72;state.heading=unit(context.player.x-enemy.x,context.player.y-enemy.y);enemy.timer=3.8;return {velocity:{x:0,y:0}};}
    const direction=unit(context.player.x-enemy.x,context.player.y-enemy.y),speed=30+context.area*2;
    return {velocity:{x:direction.x*speed,y:direction.y*speed}};
  }
  if(state.mode==='windup'){
    state.modeTime=(state.modeTime??0)-context.dt;
    if(state.modeTime<=0){state.mode='dash';state.modeTime=.42;}
    return {velocity:{x:0,y:0}};
  }
  if(state.mode==='dash'){
    state.modeTime=(state.modeTime??0)-context.dt;
    if(state.modeTime<=0){state.mode='recover';state.modeTime=.75;return {velocity:{x:0,y:0}};}
    return {velocity:{x:(state.heading?.x??0)*310,y:(state.heading?.y??0)*310}};
  }
  state.modeTime=(state.modeTime??0)-context.dt;
  if(state.modeTime<=0)state.mode='approach';
  return {velocity:{x:0,y:0}};
}

function hopperIntent(enemy:Enemy,context:EnemyMovementContext):EnemyMoveIntent {
  const state=enemy.behavior!;state.mode??='approach';
  if(state.mode==='windup'){
    state.modeTime=(state.modeTime??0)-context.dt;
    if(state.modeTime<=0){state.mode='hop';state.modeTime=.48;}
    return {velocity:{x:0,y:0}};
  }
  if(state.mode==='hop'){
    const landing=state.landing??enemy;
    if(dist(enemy,landing)<8||(state.modeTime??0)<=0){state.mode='recover';state.modeTime=.7;state.landing=undefined;state.alerted=false;return {velocity:{x:0,y:0}};}
    state.modeTime=(state.modeTime??0)-context.dt;
    const direction=unit(landing.x-enemy.x,landing.y-enemy.y);
    return {velocity:{x:direction.x*225,y:direction.y*225},ignoreWalls:state.hopOverSmallWall===true};
  }
  if(state.mode==='recover'){
    state.modeTime=(state.modeTime??0)-context.dt;
    if(state.modeTime<=0)state.mode='approach';
    return {velocity:{x:0,y:0}};
  }
  const direction=unit(context.player.x-enemy.x,context.player.y-enemy.y),d=dist(enemy,context.player);
  if(enemy.timer<=0&&d>145&&d<360){
    const landing={x:context.player.x+direction.x*110,y:context.player.y+direction.y*110};
    if(context.isFree(landing,enemy.radius)){
      const obstacles=context.walls.filter(w=>lineIntersectsRect(enemy,landing,w));
      const safeHop=obstacles.length<=1&&obstacles.every(w=>w.w<=82&&w.h<=82);
      if(!obstacles.length||safeHop){state.mode='windup';state.modeTime=.55;state.landing=landing;state.hopOverSmallWall=safeHop&&obstacles.length===1;enemy.timer=3.2;return {velocity:{x:0,y:0}};}
    }
  }
  return {velocity:{x:direction.x*42,y:direction.y*42}};
}

/** Return the enemy's intended velocity; collision resolution stays in Game. */
export function movementIntent(enemy:Enemy,context:EnemyMovementContext):EnemyMoveIntent {
  const state=enemy.behavior??(enemy.behavior={});
  const toward=unit(context.player.x-enemy.x,context.player.y-enemy.y);
  switch(enemy.type){
    case 'bomber': return {velocity:state.mode==='windup'?{x:0,y:0}:{x:toward.x*38,y:toward.y*38}};
    case 'burrower': {
      if(state.mode==='burrow'){
        state.modeTime=(state.modeTime??0)-context.dt;
        if(state.modeTime<=0&&state.landing){enemy.x=state.landing.x;enemy.y=state.landing.y;state.landing=undefined;state.mode='recover';state.modeTime=.55;state.alerted=false;}
        return {velocity:{x:0,y:0}};
      }
      if(state.mode==='recover'){state.modeTime=(state.modeTime??0)-context.dt;if(state.modeTime<=0)state.mode='approach';return {velocity:{x:0,y:0}};}
      return {velocity:{x:toward.x*32,y:toward.y*32}};
    }
    case 'guardian': {
      const ally=context.enemies.filter(other=>other!==enemy&&other.hp>0&&!other.armor&&dist(enemy,other)<230).sort((a,b)=>dist(enemy,a)-dist(enemy,b))[0];
      if(ally&&dist(enemy,ally)>105){const d=unit(ally.x-enemy.x,ally.y-enemy.y);return {velocity:{x:d.x*24,y:d.y*24}};}
      return {velocity:{x:toward.x*16,y:toward.y*16}};
    }
    case 'duelist': {
      state.modeTime=(state.modeTime??0)-context.dt;if(state.flankSide===undefined)state.flankSide=1;
      if(state.modeTime<=0){state.flankSide=state.flankSide===1?-1:1;state.modeTime=3.2;}
      const d=dist(enemy,context.player),radial=d>255?1:d<170?-1:0,side={x:-toward.y,y:toward.x},speed=48+context.area*1.5;
      return {velocity:{x:toward.x*speed*radial+side.x*speed*.82*state.flankSide,y:toward.y*speed*radial+side.y*speed*.82*state.flankSide}};
    }
    case 'webber': {
      const d=dist(enemy,context.player),radial=d>285?22:d<175?-30:0,side={x:-toward.y,y:toward.x},orbit=Math.sin(context.elapsed*.55+enemy.x*.01)<0?-1:1;
      return {velocity:{x:toward.x*radial+side.x*22*orbit,y:toward.y*radial+side.y*22*orbit}};
    }
    case 'sentinel': case 'beam_weaver': case 'siege_cannon': return {velocity:{x:0,y:0}};
    case 'hive_caller': {const d=dist(enemy,context.player),radial=d>275?12:d<185?-24:0;return {velocity:{x:toward.x*radial,y:toward.y*radial}};}
    case 'reanimator': {
      if(state.mode==='channel')return {velocity:{x:0,y:0}};
      const corpse=context.enemies.filter(other=>other!==enemy&&other.hp<=0&&other.type!=='boss'&&!other.behavior?.reanimated).sort((a,b)=>dist(enemy,a)-dist(enemy,b))[0];
      if(corpse&&dist(enemy,corpse)>72){const d=unit(corpse.x-enemy.x,corpse.y-enemy.y);return {velocity:{x:d.x*15,y:d.y*15}};}
      return {velocity:{x:toward.x*12,y:toward.y*12}};
    }
    case 'hunker': return {velocity:{x:0,y:0}};
    case 'repair_bot': {
      const target=context.enemies.filter(other=>other!==enemy&&other.hp>0&&other.type==='armored'&&!other.armor).sort((a,b)=>dist(enemy,a)-dist(enemy,b))[0];
      if(target&&dist(enemy,target)>62)return {velocity:{x:unit(target.x-enemy.x,target.y-enemy.y).x*25,y:unit(target.x-enemy.x,target.y-enemy.y).y*25}};
      return {velocity:{x:toward.x*18,y:toward.y*18}};
    }
    case 'phase_shift': {
      state.phaseTime=(state.phaseTime??0)+context.dt;
      state.mode=state.phaseTime%3.8<2.5?'approach':'phase';
      return {velocity:{x:toward.x*37,y:toward.y*37}};
    }
    case 'front_shield': state.heading=toward;return {velocity:{x:toward.x*28,y:toward.y*28}};
    case 'moving_mirror': {const angle=context.elapsed*.8;state.mirror={x:enemy.x+Math.cos(angle)*34,y:enemy.y+Math.sin(angle)*24};return {velocity:{x:toward.x*20,y:toward.y*20}};}
    case 'squad_commander': {
      state.modeTime=(state.modeTime??0)+context.dt;
      if(state.modeTime>5){state.modeTime=0;state.lastAction=context.elapsed;}
      return {velocity:{x:toward.x*24,y:toward.y*24}};
    }
    case 'echo_stalker': {
      const lagged=context.playerHistory?.(2.4);
      const target=lagged&&context.isFree(lagged,enemy.radius)?lagged:context.player;
      const direction=unit(target.x-enemy.x,target.y-enemy.y);
      return {velocity:{x:direction.x*31,y:direction.y*31}};
    }
    case 'shooter': {
      const d=dist(enemy,context.player),angle=Math.atan2(context.player.y-enemy.y,context.player.x-enemy.x);
      const radial=d>350?40+context.area*2:d<215?-(28+context.area*2):Math.max(-14,Math.min(14,(d-280)*.2));
      const orbit=d<215?14+context.area:d<=350?(24+context.area*2)*(Math.sin(context.elapsed*.65+(enemy.x+enemy.y)*.003)<0?-1:1):0;
      return {velocity:{x:Math.cos(angle)*radial+Math.cos(angle+Math.PI/2)*orbit,y:Math.sin(angle)*radial+Math.sin(angle+Math.PI/2)*orbit}};
    }
    case 'boss': return {velocity:{x:toward.x*context.bossSpeed,y:toward.y*context.bossSpeed}};
    case 'armored': return {velocity:{x:toward.x*(38+context.area*4),y:toward.y*(38+context.area*4)}};
    case 'dasher': return dasherIntent(enemy,context);
    case 'flanker': {const direction=flankerVelocity(enemy,context),speed=46+context.area;return {velocity:{x:direction.x*speed,y:direction.y*speed}};}
    case 'trigger_hound': {
      state.triggerBoost=Math.max(0,(state.triggerBoost??0)-context.dt);
      const speed=state.triggerBoost>0?88+context.area*3:27+context.area*2;
      return {velocity:{x:toward.x*speed,y:toward.y*speed}};
    }
    case 'pack_runner': {
      state.packBoost=Math.max(0,(state.packBoost??0)-context.dt);
      const mates=context.enemies.filter(other=>other!==enemy&&other.hp>0&&enemy.squad!==undefined&&other.squad===enemy.squad);
      const center=mates.length?mates.reduce((sum,other)=>({x:sum.x+other.x/mates.length,y:sum.y+other.y/mates.length}),{x:0,y:0}):context.player;
      const desired=unit(context.player.x*.72+center.x*.28-enemy.x,context.player.y*.72+center.y*.28-enemy.y);
      const speed=(39+context.area*2)*(state.packBoost>0?1.45:1);
      return {velocity:{x:desired.x*speed,y:desired.y*speed}};
    }
    case 'hopper': return hopperIntent(enemy,context);
    case 'zigzag': {
      const lateral=Math.sin(context.elapsed*4.2+(enemy.x*7+enemy.y*13)*.013)*.72;
      const side={x:-toward.y,y:toward.x};
      return {velocity:{x:toward.x*(43+context.area*2)+side.x*(43+context.area*2)*lateral,y:toward.y*(43+context.area*2)+side.y*(43+context.area*2)*lateral}};
    }
    default: {const speed=enemy.type==='basic'?50+context.area*4:enemyDefinition(enemy.type).speed+context.area*2;return {velocity:{x:toward.x*speed,y:toward.y*speed}};}
  }
}


