import { CHARACTERS, CONFIG, type Vec, type Rect } from '../data';
import { STAGES } from '../world';
import type { Game, Enemy, Effect } from '../engine';
import { drawSoldier, shape } from './soldier';

type Particle = Vec & { vx:number; vy:number; life:number; max:number; color:string; size:number; kind:'spark'|'case'|'dust'|'plate' };
type Impact = Vec & { life:number; max:number; armor:boolean; direction:number };
type Motion = { x:number; y:number; angle:number; speed:number; death:number; flash:number; hp:number };
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};

/** Presentation only: observes Game, owns all animation, particles, caches and camera offsets. */
export class Renderer {
  private floorCanvas=document.createElement('canvas');
  private floorKey=''; private seen=new WeakSet<Effect>(); private motions=new WeakMap<Enemy,Motion>();
  private playerMotion:Motion={x:0,y:0,angle:0,speed:0,death:0,flash:0,hp:1};
  private particles:Particle[]=[];private impacts:Impact[]=[];
  private time=0;private recoil=0;private deathTime=0;private openProgress=0;private unlockBanner=0;
  private oldRemaining=1;private oldPlayer?:object;private camera={x:0,y:0};private shake=0;
  private glow:HTMLCanvasElement;private redGlow:HTMLCanvasElement;
  lastRenderMs=0;
  shakeScale=1; flashScale=1; debugHitboxes=false;
  constructor(private ctx:CanvasRenderingContext2D){this.floorCanvas.width=CONFIG.width;this.floorCanvas.height=CONFIG.height;this.glow=this.makeGlow('150,225,249');this.redGlow=this.makeGlow('255,127,90');}
  screenToWorld(point:Vec):Vec{return{x:point.x-this.camera.x,y:point.y-this.camera.y};}
  get cameraOffset(){return {...this.camera};}
  private makeGlow(rgb:string){const c=document.createElement('canvas');c.width=64;c.height=64;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,`rgba(${rgb},.4)`);g.addColorStop(.3,`rgba(${rgb},.12)`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return c;}
  event(kind:string,game:Game,aim:Vec){
    if(kind==='shot'||kind==='heavy'||kind==='triple'){
      this.recoil=1;this.shake=game.weapon==='heavy'?1.5:.4;
      const angle=Math.atan2(aim.y-game.player.y,aim.x-game.player.x);
      this.emit(game.player.x+Math.cos(angle)*25,game.player.y+Math.sin(angle)*25,3,'spark','#ffe8b2',70,.13);
      this.particles.push({x:game.player.x+Math.cos(angle+1)*12,y:game.player.y+Math.sin(angle+1)*12,vx:Math.cos(angle+1.4)*65,vy:Math.sin(angle+1.4)*65,life:.65,max:.65,color:'#c6ae7a',size:2.5,kind:'case'});
    }
    if(kind==='gameover'){this.deathTime=0;this.playerMotion.flash=1;this.shake=1.6;}
  }
  private emit(x:number,y:number,count:number,kind:Particle['kind'],color:string,speed:number,life:number){
    for(let i=0;i<count && this.particles.length<160;i++){const a=hash(x+i*12,this.time*100)*Math.PI*2;this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,color,size:kind==='plate'?4:kind==='dust'?2:1.5,kind});}
  }
  private label(ctx:CanvasRenderingContext2D,s:string,x:number,y:number,color='#9eabb5',size=10,align:CanvasTextAlign='left'){
    ctx.font=`600 ${size}px "Segoe UI", sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y);
  }
  private softLight(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  private steel(ctx:CanvasRenderingContext2D,r:Rect,outer=false){
    ctx.fillStyle='#060c1480';ctx.fillRect(r.x+7,r.y+9,r.w,r.h+7);
    const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);g.addColorStop(0,'#596976');g.addColorStop(.1,'#374955');g.addColorStop(.5,'#253740');g.addColorStop(1,'#172933');
    shape(ctx,r.x,r.y,r.w,r.h,outer?1:4,g as unknown as string,'#71818b');
    shape(ctx,r.x+4,r.y+4,r.w-8,r.h-8,2,'#273a44','#465965');
    ctx.strokeStyle='#c1dde155';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x+5,r.y+5);ctx.lineTo(r.x+r.w-5,r.y+5);ctx.stroke();
    ctx.strokeStyle='#6fadc477';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(r.x+2,r.y+r.h-3);ctx.lineTo(r.x+r.w-2,r.y+r.h-3);ctx.stroke();
    if(!outer){for(let y=r.y+30;y<r.y+r.h-15;y+=60){ctx.strokeStyle='#101d24';ctx.beginPath();ctx.moveTo(r.x+8,y);ctx.lineTo(r.x+r.w-8,y);ctx.stroke();}
      for(const[x,y]of[[r.x+9,r.y+9],[r.x+r.w-9,r.y+9],[r.x+9,r.y+r.h-9],[r.x+r.w-9,r.y+r.h-9]]){ctx.fillStyle='#92a2a7';ctx.fillRect(x-1,y-1,2,2);}
      if(r.w>80)this.label(ctx,'RS / 09',r.x+14,r.y+25,'#8fabb4',9);
    }
  }
  private hazards(game:Game){const ctx=this.ctx;for(const h of game.hazards){const r=h.rect;
    if(h.source.type==='collapse'){
      ctx.fillStyle=h.active?'#08151d':h.warning?(Math.sin(this.time*10)>0?'#bd715b99':'#a8875766'):'#172c3588';ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle=h.active?'#ec997e':h.warning?'#ffbf75':'#658490';ctx.lineWidth=h.warning?3:2;ctx.strokeRect(r.x+2,r.y+2,r.w-4,r.h-4);
      if(h.active){ctx.strokeStyle='#7aa6b966';ctx.beginPath();ctx.moveTo(r.x+7,r.y+7);ctx.lineTo(r.x+r.w-7,r.y+r.h-7);ctx.moveTo(r.x+r.w-7,r.y+7);ctx.lineTo(r.x+7,r.y+r.h-7);ctx.stroke();}
      else if(h.warning){this.label(ctx,`DROP ${Math.max(1,Math.ceil((1-h.progress)*h.source.warningSeconds))}`,r.x+r.w/2,r.y+r.h/2+4,'#ffe2bc',10,'center');}
      else this.label(ctx,'FRAGILE',r.x+r.w/2,r.y+r.h/2+4,'#8eb0ba',8,'center');
    } else {
      const e=h.source.rect,span=h.source.span??0;
      ctx.strokeStyle='#e4aa8066';ctx.setLineDash([6,5]);ctx.strokeRect(e.x-(h.source.axis==='x'?span:0)-3,e.y-(h.source.axis==='y'?span:0)-3,e.w+(h.source.axis==='x'?span*2:0)+6,e.h+(h.source.axis==='y'?span*2:0)+6);ctx.setLineDash([]);
      if(h.warning){ctx.fillStyle='#d99b5c77';ctx.fillRect(r.x,r.y,r.w,r.h);this.label(ctx,'SHUTTER',r.x+r.w/2,r.y-8,'#ffd6ac',9,'center');}
      else{this.steel(ctx,r);ctx.strokeStyle='#e8b78b';ctx.lineWidth=3;ctx.strokeRect(r.x+2,r.y+2,r.w-4,r.h-4);}
    }
  }}
  private bakeFloor(game:Game){
    const ctx=this.floorCanvas.getContext('2d')!,b=game.layout.bounds;
    const area=STAGES[game.stage-1].area;
    const tones:[[number,number,number],...[number,number,number][]]=[[53,66,77],[67,62,60],[54,62,82],[68,57,65],[44,54,73]];
    const base=tones[area];
    ctx.fillStyle='#101b25';ctx.fillRect(0,0,1120,640);
    // Surrounding facility depth, not a colored frame around the arena.
    for(let y=0;y<640;y+=80)for(let x=0;x<1120;x+=80){ctx.fillStyle=(x+y)%160?'#17242e':'#15222c';ctx.fillRect(x+1,y+1,78,78);}
    this.softLight(ctx,550,280,650,'#7996a219');
    ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    ctx.fillStyle=STAGES[game.stage-1].palette.floor;ctx.fillRect(b.x,b.y,b.w,b.h);
    for(let y=b.y;y<b.y+b.h;y+=80)for(let x=b.x;x<b.x+b.w;x+=96){const light=Math.floor(hash(x,y)*8);ctx.fillStyle=`rgb(${base[0]+light},${base[1]+light},${base[2]+light})`;ctx.fillRect(x+1,y+1,94,78);ctx.fillStyle='#80919b28';ctx.fillRect(x+2,y+2,92,1);ctx.fillStyle='#111f2a77';ctx.fillRect(x+1,y+78,94,1);
      if(hash(x,y)>.4){ctx.fillStyle='#1f303b';ctx.fillRect(x+8,y+8,2,2);ctx.fillRect(x+85,y+68,2,2);}
    }
    // Low-contrast, static wear. Geometry is cached once per floor.
    ctx.strokeStyle='#a6b9bf0b';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<90;i++){const x=b.x+hash(i,13)*b.w,y=b.y+hash(i,57)*b.h;ctx.moveTo(x,y);ctx.lineTo(x+hash(i,7)*15,y+4);}ctx.stroke();
    ctx.strokeStyle='#84968720';ctx.setLineDash([15,12]);ctx.beginPath();ctx.moveTo(b.x+64,b.y+b.h-78);ctx.lineTo(b.x+b.w-64,b.y+b.h-78);ctx.stroke();ctx.setLineDash([]);
    // Drains and cable conduits stay along boundaries and never obstruct movement.
    for(let y=b.y+90;y<b.y+b.h-70;y+=9){ctx.fillStyle='#1b2b37';ctx.fillRect(b.x+17,y,17,3);ctx.fillRect(b.x+b.w-34,y,17,3);}
    ctx.strokeStyle='#1f303b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x+40,b.y+25);ctx.lineTo(b.x+240,b.y+25);ctx.quadraticCurveTo(b.x+255,b.y+25,b.x+255,b.y+47);ctx.lineTo(b.x+255,b.y+65);ctx.stroke();
    // Painted caution markers are localized; the center stays quiet for bullets.
    for(const p of[game.entry,game.exit]){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#e2c27360';for(let i=-3;i<4;i++){ctx.save();ctx.translate(i*9,36);ctx.rotate(-.5);ctx.fillRect(-2,-3,4,9);ctx.restore();}ctx.restore();}
    this.label(ctx,`${String(game.stage).padStart(2,'0')}/${String(game.floor+1).padStart(2,'0')}`,b.x+b.w/2,b.y+b.h/2+20,'#9babb91b',80,'center');
    this.label(ctx,game.layout.name,b.x+b.w/2,b.y+b.h/2+45,'#c5d5db22',12,'center');
    this.label(ctx,'BALLISTIC RESEARCH / RESTRICTED',b.x+75,b.y+30,'#adbdc154',9);
    // A few broad ceiling pools give depth without concealing targets in darkness.
    this.softLight(ctx,b.x+b.w*.32,b.y+b.h*.35,240,'#afc8d516');this.softLight(ctx,b.x+b.w*.75,b.y+b.h*.6,230,'#b8c5b714');
    const shade=ctx.createLinearGradient(b.x,0,b.x+b.w,0);shade.addColorStop(0,'#0a152b28');shade.addColorStop(.12,'#00000000');shade.addColorStop(.85,'#00000000');shade.addColorStop(1,'#07142738');ctx.fillStyle=shade;ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.restore();
    this.steel(ctx,{x:b.x-18,y:b.y-18,w:b.w+36,h:18},true);this.steel(ctx,{x:b.x-18,y:b.y+b.h,w:b.w+36,h:18},true);this.steel(ctx,{x:b.x-18,y:b.y,w:18,h:b.h},true);this.steel(ctx,{x:b.x+b.w,y:b.y,w:18,h:b.h},true);
    // Light strips embedded into the room side of the reflective surface.
    for(let x=b.x+55;x<b.x+b.w-30;x+=180){shape(ctx,x,b.y-10,65,3,1,'#acc9d6');this.softLight(ctx,x+32,b.y+8,65,'#add8e72a');shape(ctx,x,b.y+b.h+7,65,3,1,'#91aebc');}
    for(const w of game.layout.walls)this.steel(ctx,w);
  }
  private gate(game:Game,exit:boolean){
    const ctx=this.ctx,p=exit?game.exit:game.entry;
    const open=exit?this.openProgress:1;const color=exit?(game.remaining?'#ec937c':'#b8e5d4'):'#9dbfcb';
    ctx.drawImage(exit&&game.remaining?this.redGlow:this.glow,p.x-60,p.y-58,120,116);
    ctx.save();ctx.translate(p.x,p.y);
    shape(ctx,-29,-30,58,60,5,'#172a34','#6e8793');shape(ctx,-23,-25,46,48,2,'#101d26');
    ctx.save();ctx.beginPath();ctx.rect(-22,-25,44,48);ctx.clip();
    for(const side of[-1,1]){const x=side<0?-22-open*19:open*19;const g=ctx.createLinearGradient(x,0,x+22,0);g.addColorStop(0,'#526773');g.addColorStop(1,'#324653');shape(ctx,x,-25,22,48,1,g as unknown as string,'#748a93');ctx.fillStyle='#a5b7be';ctx.fillRect(x+9,-18,2,33);}
    ctx.restore();
    shape(ctx,-32,-25,4,44,1,color);shape(ctx,28,-25,4,44,1,color);shape(ctx,-26,-33,52,5,1,'#a7bac0');
    this.label(ctx,exit?'EXIT':'ENTRY',0,-41,color,12,'center');
    this.label(ctx,exit?(game.remaining?'LOCKED':'UNLOCKED'):'AIRLOCK',0,49,color,9,'center');
    if(open>.7){ctx.strokeStyle=color;ctx.lineWidth=2;for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(-7,12-i*12);ctx.lineTo(0,5-i*12);ctx.lineTo(7,12-i*12);ctx.stroke();}}
    ctx.restore();
  }
  private motion(e:Enemy,dt:number):Motion{
    let m=this.motions.get(e);if(!m){m={x:e.x,y:e.y,angle:0,speed:0,death:0,flash:0,hp:e.hp};this.motions.set(e,m);}
    const dx=e.x-m.x,dy=e.y-m.y;m.speed=Math.hypot(dx,dy)/Math.max(.001,dt);if(m.speed>1)m.angle=Math.atan2(dy,dx);
    if(e.hp<=0 && m.hp>0){this.emit(e.x,e.y,5,'dust','#af9490',40,.4);m.death=.001;}
    if(e.hp<=0)m.death+=dt;m.hp=e.hp;m.x=e.x;m.y=e.y;return m;
  }
  private bullet(b:Game['bullets'][number]){
    const ctx=this.ctx,player=b.owner==='player',color=player?'#b5efff':'#ff9776';
    // Tracer segments are cut at large discontinuities, so reflections never draw across steel.
    ctx.strokeStyle=color;ctx.lineWidth=player?b.radius*.55:1.5;ctx.lineCap='round';ctx.globalAlpha=.45;ctx.beginPath();
    for(let i=0;i<b.trail.length;i++){const p=b.trail[i],last=b.trail[i-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>10)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.globalAlpha=1;
    ctx.drawImage(player?this.glow:this.redGlow,b.x-13-b.radius,b.y-13-b.radius,26+b.radius*2,26+b.radius*2);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
    if(player){shape(ctx,-b.radius*1.7,-b.radius*.6,b.radius*2.6,b.radius*1.2,b.radius*.5,'#effcff');shape(ctx,-b.radius*1.5,-b.radius*.35,b.radius*1.5,b.radius*.7,1,'#8bdef5');}
    else{ctx.fillStyle='#ff9b76';ctx.beginPath();ctx.moveTo(b.radius+1,0);ctx.lineTo(0,-b.radius);ctx.lineTo(-b.radius-1,0);ctx.lineTo(0,b.radius);ctx.closePath();ctx.fill();shape(ctx,-1,-1,3,2,1,'#ffe3bb');}
    ctx.restore();
  }
  private observeEffects(game:Game){
    for(const e of game.effects){if(this.seen.has(e))continue;this.seen.add(e);const armor=Boolean(e.text);const wall=e.color==='#e7fa9e';
      this.emit(e.x,e.y,armor?9:wall?3:4,armor?'plate':'spark',armor?'#c0e5f0':wall?'#b2e7fa':'#ffbe94',armor?95:wall?80:60,armor?.5:.23);
      if(wall||armor){const closest=game.bullets.filter(b=>b.owner==='player').reduce<Game['bullets'][number]|undefined>((best,b)=>!best||Math.hypot(b.x-e.x,b.y-e.y)<Math.hypot(best.x-e.x,best.y-e.y)?b:best,undefined);
        this.impacts.push({x:e.x,y:e.y,life:armor?.4:.18,max:armor?.4:.18,armor,direction:closest?Math.atan2(closest.vy,closest.vx):0});}
    }
    if(this.impacts.length>60)this.impacts.splice(0,this.impacts.length-60);
  }
  draw(game:Game,aim:Vec,dt:number){
    const start=performance.now();const ctx=this.ctx;
    const active=game.state==='playing';const animDt=active||game.state==='dead'||game.state==='title'?dt:0;
    this.time+=animDt;this.recoil=Math.max(0,this.recoil-animDt*10);this.shake=Math.max(0,this.shake-dt*9);
    if(this.oldPlayer!==game.player){this.oldPlayer=game.player;this.playerMotion={x:game.player.x,y:game.player.y,angle:0,speed:0,death:0,flash:0,hp:game.player.hp};this.particles=[];this.impacts=[];this.seen=new WeakSet();this.oldRemaining=game.remaining;this.openProgress=0;this.unlockBanner=0;this.deathTime=0;}
    if(this.oldRemaining>0&&!game.remaining){this.unlockBanner=2.1;}
    this.oldRemaining=game.remaining;this.unlockBanner=Math.max(0,this.unlockBanner-animDt);
    this.openProgress=clamp(this.openProgress+(game.remaining?-animDt:animDt)*1.8,0,1);
    const key=`${game.stage}:${game.floor}`;if(key!==this.floorKey){this.floorKey=key;this.bakeFloor(game);}
    const p=game.player,m=this.playerMotion;const dx=p.x-m.x,dy=p.y-m.y;m.speed=Math.hypot(dx,dy)/Math.max(.001,dt);if(m.speed>1)m.angle=Math.atan2(dy,dx);m.x=p.x;m.y=p.y;
    if(game.state==='dead'){this.deathTime+=dt;m.death=clamp(this.deathTime,0,1);m.flash=Math.max(0,1-this.deathTime*5);}else m.death=0;
    // Camera is a presentation-only 2px follow. Pointer input applies the inverse transform.
    const title=game.state==='title';const targetX=title?0:clamp((560-p.x)*.005,-2,2),targetY=title?0:clamp((320-p.y)*.005,-2,2);
    this.camera.x+=(targetX-this.camera.x)*(1-Math.exp(-dt*5));this.camera.y+=(targetY-this.camera.y)*(1-Math.exp(-dt*5));
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#14232d';ctx.fillRect(0,0,1120,640);
    ctx.save();ctx.translate(this.camera.x+Math.sin(this.time*110)*this.shake*.3*this.shakeScale,this.camera.y+Math.cos(this.time*93)*this.shake*.3*this.shakeScale);
    ctx.drawImage(this.floorCanvas,0,0);this.hazards(game);this.gate(game,false);this.gate(game,true);
    if(title)this.titleScene();else{
      const sorted=[...game.enemies].sort((a,b)=>a.y-b.y);
      for(const e of sorted){const motion=this.motion(e,animDt);if(e.hp<=0&&motion.death>.65)continue;
        drawSoldier(ctx,{position:e,aim:Math.atan2(p.y-e.y,p.x-e.x),move:{x:Math.cos(motion.angle),y:Math.sin(motion.angle)},time:this.time,running:motion.speed>1&&active,role:e.type,armor:e.armor,hit:e.hit*4,death:e.hp<=0?motion.death:0});
        if(e.type==='boss'&&e.hp>0){shape(ctx,e.x-40,e.y-61,80,4,2,'#203541');shape(ctx,e.x-40,e.y-61,80*e.hp/game.bossSpec.hp,4,2,'#e59a87');this.label(ctx,game.stage%10===0?game.bossSpec.name:'ELITE REFLECTOR',e.x,e.y-68,'#eac6b9',10,'center');if(e.timer<.65){ctx.strokeStyle='#ffb78baa';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,43+Math.sin(this.time*14)*2,0,Math.PI*2);ctx.stroke();}}}
      // A precise faint footprint keeps collision location readable under the taller soldier.
      ctx.strokeStyle='#e2e9db44';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,CONFIG.playerRadius,0,Math.PI*2);ctx.stroke();
      drawSoldier(ctx,{position:p,aim:Math.atan2(aim.y-p.y,aim.x-p.x),move:{x:Math.cos(m.angle),y:Math.sin(m.angle)},time:this.time,running:m.speed>2&&active,role:'player',character:game.character,accent:CHARACTERS[game.character].accent,weapon:game.weapon,recoil:this.recoil,hit:m.flash*this.flashScale,death:m.death});
      for(const b of game.bullets)this.bullet(b);
      this.observeEffects(game);
    }
    for(const impact of this.impacts){impact.life-=animDt;if(impact.life<=0)continue;ctx.globalAlpha=impact.life/impact.max*this.flashScale;ctx.drawImage(this.glow,impact.x-30,impact.y-30,60,60);ctx.strokeStyle='#d0f4ff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(impact.x,impact.y);ctx.lineTo(impact.x+Math.cos(impact.direction)*34,impact.y+Math.sin(impact.direction)*34);ctx.stroke();if(impact.armor){this.label(ctx,'CLANG / ARMOR BREAK',impact.x,impact.y-34,'#d5f0f8',10,'center');}ctx.globalAlpha=1;}
    this.impacts=this.impacts.filter(e=>e.life>0);
    for(const part of this.particles){part.life-=animDt;part.x+=part.vx*animDt;part.y+=part.vy*animDt;part.vx*=Math.exp(-animDt*4);part.vy*=Math.exp(-animDt*4);ctx.globalAlpha=clamp(part.life/part.max,0,1)*this.flashScale;ctx.fillStyle=part.color;
      if(part.kind==='spark'){ctx.strokeStyle=part.color;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(part.x,part.y);ctx.lineTo(part.x-part.vx*.035,part.y-part.vy*.035);ctx.stroke();}
      else{ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.life*5);ctx.fillRect(-part.size/2,-part.size/2,part.size,part.kind==='case'?1.2:part.size);ctx.restore();}}
    ctx.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    if(active){ctx.strokeStyle='#e7f4f3';ctx.lineWidth=1;ctx.beginPath();ctx.arc(aim.x,aim.y,6,0,Math.PI*2);for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.moveTo(aim.x+Math.cos(a)*9,aim.y+Math.sin(a)*9);ctx.lineTo(aim.x+Math.cos(a)*13,aim.y+Math.sin(a)*13);}ctx.stroke();}
    if(game.fatalBullet&&game.state==='dead'){const b=game.fatalBullet;ctx.strokeStyle='#f9e2db';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(b.x,b.y,23,0,Math.PI*2);ctx.stroke();this.label(ctx,'FATAL ROUND',b.x,b.y+36,'#ffdfd5',10,'center');}
    if(this.debugHitboxes){ctx.save();ctx.strokeStyle='#62f2c9';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,CONFIG.playerRadius,0,Math.PI*2);for(const e of game.enemies)if(e.hp>0){ctx.moveTo(e.x+e.radius,e.y);ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);}ctx.stroke();ctx.strokeStyle='#ffe27b';for(const b of game.bullets){ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle='#ff7c7c';for(const h of game.hazards)ctx.strokeRect(h.rect.x,h.rect.y,h.rect.w,h.rect.h);ctx.restore();}
    ctx.restore();
    if(this.unlockBanner>0&&!title){ctx.globalAlpha=Math.min(1,this.unlockBanner*2);shape(ctx,425,280,270,62,8,'#12262de8','#a9d9c744');this.label(ctx,'EXIT UNLOCKED',560,307,'#cdece0',18,'center');this.label(ctx,'残った跳弾に注意して、出口へ',560,327,'#b9ccc9',10,'center');ctx.globalAlpha=1;}
    if(game.messageTime>0&&active&&!this.unlockBanner){const message=game.message.startsWith('EXIT OPEN')?'EXIT UNLOCKED — 残った自弾に注意':game.message;shape(ctx,330,566,460,27,5,'#13242bdd');this.label(ctx,message,560,584,'#c5d6dc',11,'center');}
    this.lastRenderMs=performance.now()-start;
  }
  private titleScene(){
    const ctx=this.ctx;
    // A cinematic, program-drawn facility and one shared chibi soldier. No external assets.
    ctx.save();ctx.fillStyle='#17303e33';ctx.fillRect(0,0,1120,640);
    for(const[x,y,w,h]of[[760,200,100,210],[950,320,100,180],[620,380,90,95]])this.steel(ctx,{x,y,w,h});
    this.softLight(ctx,820,420,270,'#8eafbf25');
    ctx.strokeStyle='#bad8e653';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(645,135);ctx.lineTo(970,270);ctx.lineTo(705,480);ctx.lineTo(1000,555);ctx.stroke();
    ctx.strokeStyle='#d6e9f399';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(740,75);ctx.lineTo(1040,180);ctx.lineTo(785,360);ctx.stroke();
    const points=[{x:645,y:135},{x:970,y:270},{x:705,y:480},{x:1000,y:555}];
    const phase=Number.isFinite(this.time)?((this.time*.11)%1+1)%1:0;
    const progress=phase*(points.length-1),segment=clamp(Math.floor(progress),0,points.length-2),f=clamp(progress-segment,0,1);
    const a=points[segment],b=points[segment+1]??a,x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
    ctx.drawImage(this.glow,x-16,y-16,32,32);shape(ctx,x-4,y-2,8,4,2,'#edfaff');
    ctx.save();ctx.translate(820,460);ctx.scale(3.7,3.7);drawSoldier(ctx,{position:{x:0,y:0},aim:-.5,move:{x:0,y:0},time:this.time,running:false,role:'player',weapon:'standard'});ctx.restore();
    this.label(ctx,'BALLISTIC CONTAINMENT / SECTOR 01',805,580,'#9ab3c1',10,'center');
    ctx.restore();
  }
}
