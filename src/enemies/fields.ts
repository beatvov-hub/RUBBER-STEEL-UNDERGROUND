import type { Bullet, Enemy } from '../engine';
import type { EnemyType } from './types';

const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

/** Apply bullet-altering enemy fields without changing bullet ownership or expiry rules. */
export function applyEnemyBulletFields(bullet:Bullet,enemies:Enemy[],dt:number,spawnClone: (source:Bullet)=>Bullet|undefined) {
  if(bullet.owner!=='player')return;
  for(const field of enemies){
    if(field.hp<=0)continue;
    const point=field.type==='moving_mirror'?(field.behavior?.mirror??field):field;
    const radius=field.type==='bullet_orbiter'?118:field.type==='prism_splitter'?92:field.type==='moving_mirror'?37:field.type==='magnetizer'||field.type==='accelerator'||field.type==='slow_field'?105:0;
    if(!radius||distance(bullet,point)>radius)continue;
    if(field.type==='magnetizer'){
      const speed=Math.hypot(bullet.vx,bullet.vy),turn=Math.min(.012,dt*.3),angle=Math.atan2(field.y-bullet.y,field.x-bullet.x);
      bullet.vx+=(Math.cos(angle)*speed-bullet.vx)*turn;bullet.vy+=(Math.sin(angle)*speed-bullet.vy)*turn;
    }else if(field.type==='accelerator'&&!bullet.fieldHits?.includes(field.type)){
      const speed=Math.hypot(bullet.vx,bullet.vy),next=Math.min(380,speed*1.24);bullet.vx*=next/speed;bullet.vy*=next/speed;bullet.fieldHits=[...(bullet.fieldHits??[]),field.type];
    }else if(field.type==='slow_field'){
      const speed=Math.hypot(bullet.vx,bullet.vy),next=Math.max(105,speed*(1-dt*.5));bullet.vx*=next/speed;bullet.vy*=next/speed;
    }else if(field.type==='prism_splitter'&&!bullet.split){
      const clone=spawnClone(bullet);if(clone){const angle=Math.atan2(bullet.vy,bullet.vx)+.24,speed=Math.hypot(bullet.vx,bullet.vy);clone.vx=Math.cos(angle)*speed;clone.vy=Math.sin(angle)*speed;clone.active=true;clone.split=true;clone.trail=[...bullet.trail];bullet.split=true;}
    }else if(field.type==='moving_mirror'&&!bullet.fieldHits?.includes(field.type)){
      const dot=bullet.vy;bullet.vy-=2*dot;bullet.y=point.y+Math.sign(bullet.y-point.y)*(18+bullet.radius+2);bullet.x=point.x;bullet.fieldHits=[...(bullet.fieldHits??[]),field.type];
    }else if(field.type==='bullet_orbiter'&&!bullet.fieldHits?.includes(field.type)){
      bullet.source='bullet_orbiter';bullet.orbitTime=1.6;bullet.fieldHits=[...(bullet.fieldHits??[]),field.type];
    }
  }
}

/** Captured player rounds remain active, armed, and dangerous throughout orbit and release. */
export function updateOrbiterRound(bullet:Bullet,enemies:Enemy[],dt:number,elapsed:number):boolean {
  if(bullet.source!=='bullet_orbiter'||bullet.orbitTime===undefined)return false;
  bullet.orbitTime-=dt;
  if(bullet.orbitTime>0){const target=enemies.find(enemy=>enemy.hp>0&&enemy.type==='bullet_orbiter'&&distance(bullet,enemy)<145);if(target){const angle=elapsed*4;bullet.x=target.x+Math.cos(angle)*55;bullet.y=target.y+Math.sin(angle)*55;return true;}}
  bullet.source=undefined;bullet.orbitTime=undefined;return false;
}
