import type { CharacterId, Weapon, Vec } from '../data';

/** Renderer contract: replace this function with a sprite-sheet adapter without touching physics. */
export type SoldierLook = {
  position: Vec; aim: number; move: Vec; time: number; running: boolean;
  role: 'player' | 'basic' | 'shooter' | 'armored' | 'boss';
  accent?: string; character?: CharacterId; armor?: boolean; weapon?: Weapon; recoil?: number; hit?: number; death?: number;
};
export function shape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}
export function drawSoldier(ctx: CanvasRenderingContext2D, look: SoldierLook) {
  const { position:p, role, aim, time } = look;
  const heavy = role === 'armored' || role === 'boss';
  const scale = role === 'boss' ? 1.85 : heavy ? 1.15 : 1;
  const player = role === 'player';
  const accent = look.accent ?? (player ? '#dce5cc' : role === 'armored' && look.armor ? '#a9d5e3' : '#ef836c');
  const olive = player ? look.character==='fire'?'#745649':look.character==='ice'?'#58717a':look.character==='thunder'?'#6b6951':'#68775b' : heavy ? '#555e66' : '#775652';
  const dead = look.death ?? 0;
  ctx.save(); ctx.translate(p.x,p.y);
  // Small soft ground contact shadow, independent of aim and limb movement.
  ellipse(ctx, 2, 13, 20*scale, 9*scale, '#070c1040');
  ellipse(ctx, 1, 12, 14*scale, 5*scale, '#060a0d55');
  ctx.scale(scale,scale);
  if (dead) { ctx.rotate(Math.min(1,dead*3)*1.3);ctx.scale(1,1-Math.min(.35,dead)); }
  const stride = look.running && !dead ? Math.sin(time*17) : 0;
  const bob = look.running && !dead ? Math.abs(Math.sin(time*17))*.9 : Math.sin(time*2)*.25;
  const dirLength = Math.max(1, Math.hypot(look.move.x,look.move.y));
  const dx = look.move.x/dirLength, dy = look.move.y/dirLength;
  // Boots travel along movement, while arms and rifle independently face the reticle.
  for (const side of [-1,1]) {
    const x=side*5+dx*stride*side*3.5, y=13+dy*stride*side*3.5;
    shape(ctx,x-3.7,y-4,7.4,8,2,'#202a30','#435059');
    shape(ctx,x-4,y+1,8,5,2,'#11191f');
    shape(ctx,x-3,y-1,6,2,1,'#738079');
  }
  ctx.translate(-Math.cos(aim)*(look.recoil??0)*1.3,bob-Math.sin(aim)*(look.recoil??0)*1.3);
  // Backpack and vest are large readable color masses, not tiny camouflage noise.
  shape(ctx,-11,-3,22,19,5,'#18252b','#34454d');
  if(player&&look.character==='fire'){shape(ctx,-15,-2,7,17,3,'#553b35',accent);shape(ctx,-16,2,3,11,1,'#a96149');}
  if(player&&look.character==='ice'){shape(ctx,-15,-5,8,18,3,'#2e505c',accent);shape(ctx,-17,1,3,9,1,'#9ed7ef');}
  if(player&&look.character==='thunder'){shape(ctx,-15,-4,8,19,3,'#4e4d3d',accent);shape(ctx,-16,-7,3,7,1,accent);}
  if(role==='shooter') { shape(ctx,-13,-5,8,20,3,'#414952','#76838a');ctx.strokeStyle='#778790';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(-12,-29);ctx.stroke();ellipse(ctx,-12,-29,1.5,1.5,'#ec8d73'); }
  shape(ctx,-9,-1,18,15,4,olive,'#8d9a88');
  shape(ctx,-6,2,12,9,2,'#39463d');
  shape(ctx,-7,8,5,5,1,'#899078');shape(ctx,2,8,5,5,1,'#899078');
  shape(ctx,-8,0,16,2,1,accent);
  if(player&&look.character==='fire'){shape(ctx,-16,-1,7,10,3,'#ad6750',accent);shape(ctx,9,-1,7,10,3,'#ad6750',accent);}
  if(player&&look.character==='ice'){shape(ctx,-14,-2,5,12,2,'#87baca',accent);shape(ctx,9,-2,5,12,2,'#87baca',accent);}
  if(player&&look.character==='thunder'){shape(ctx,-15,-2,6,10,2,'#b8a663',accent);shape(ctx,9,-2,6,10,2,'#b8a663',accent);}
  if(heavy){
    shape(ctx,-16,-1,8,11,3,'#7a878e','#b1c0c7');shape(ctx,8,-1,8,11,3,'#7a878e','#b1c0c7');
    if(look.armor){shape(ctx,-10,1,20,13,3,'#91a5b2','#d0e6ed');shape(ctx,-8,4,16,3,1,'#d0e8ee');shape(ctx,-2,1,4,13,1,'#526775');}
    else {shape(ctx,-8,2,9,10,2,'#788892');ctx.strokeStyle='#111d25';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-1,1);ctx.lineTo(-5,5);ctx.lineTo(3,8);ctx.lineTo(0,14);ctx.stroke();}
  }
  // Face and helmet: an oversized head on a compact torso establishes the human silhouette.
  ellipse(ctx,0,-12,12,11.5,'#172329');
  shape(ctx,-9,-15,18,14,6,player?'#bfad96':'#9f8b80');
  ctx.fillStyle=player?'#71816c':'#414e56';ctx.beginPath();ctx.ellipse(0,-17,12.5,9.5,0,Math.PI,Math.PI*2);ctx.lineTo(12.5,-12);ctx.quadraticCurveTo(0,-8,-12.5,-12);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#a0aca0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-17,11.5,8.5,0,Math.PI+.3,Math.PI*1.8);ctx.stroke();
  shape(ctx,-9,-14,18,5,2,'#101f28','#51656b');
  shape(ctx,Math.cos(aim)*3-5,-13,10,2,1,accent);
  shape(ctx,-3,-25,6,5,1,'#b7c2b4');shape(ctx,-2,-24,4,2,1,accent);
  if(player&&look.character==='fire'){shape(ctx,-8,-26,16,3,1,'#ad6750');shape(ctx,-4,-28,8,3,1,accent);}
  if(player&&look.character==='ice'){shape(ctx,-12,-21,24,5,2,'#8ebdcc');shape(ctx,-9,-14,18,4,2,'#c5eff5');}
  if(player&&look.character==='thunder'){shape(ctx,-2,-31,4,7,1,accent);ellipse(ctx,0,-32,2,2,'#fff1b4');}
  shape(ctx,-13,-16,4,9,2,'#222e33');shape(ctx,9,-16,4,9,2,'#222e33');
  if(role==='basic'){shape(ctx,-5,-4,10,3,1,'#b96958');}
  // Aim rotation is confined to arms and weapon, preserving a readable upright head.
  ctx.save();ctx.rotate(aim);
  const kick=(look.recoil??0)*2;
  shape(ctx,0-kick,-6,15,6,3,olive);shape(ctx,3-kick,4,13,6,3,olive);
  shape(ctx,11-kick,-4,6,6,2,'#171f24');shape(ctx,11-kick,3,6,6,2,'#171f24');
  const weapon=look.weapon??(heavy?'heavy':'standard');
  if(weapon==='heavy'){
    shape(ctx,5-kick,-5,19,11,3,'#283740','#a4b3b6');shape(ctx,18-kick,-6,8,13,2,'#61737b');shape(ctx,25-kick,-3,5,7,1,'#17262e');shape(ctx,8-kick,-4,8,2,1,accent);
  }else if(weapon==='triple'){
    shape(ctx,3-kick,-5,20,11,3,'#2a3a41','#98aab0');for(const y of[-4,0,4])shape(ctx,19-kick,y-1,10,2,1,'#b9c7cb');shape(ctx,8-kick,-3,6,5,1,accent);
  }else{
    const length=role==='shooter'?35:27;
    shape(ctx,2-kick,-3,18,7,2,'#2b3d46','#9baeb2');shape(ctx,17-kick,-2,length-17,4,1,'#8b9ea6');shape(ctx,8-kick,3,5,7,1,'#182b34');shape(ctx,9-kick,-5,5,3,1,'#b1c3c6');shape(ctx,length-kick-2,-3,3,6,1,'#23343d');
    if(role==='shooter')ellipse(ctx,length-3-kick,0,2,1.5,'#f58869');
  }
  if(player&&look.character==='fire')shape(ctx,16-kick,-5,9,2,1,accent);
  if(player&&look.character==='ice')shape(ctx,20-kick,-5,7,2,1,accent);
  if(player&&look.character==='thunder'){shape(ctx,19-kick,-6,6,2,1,accent);shape(ctx,19-kick,4,6,2,1,accent);}
  if((look.recoil??0)>.45){ctx.fillStyle='#fff1c8';ctx.beginPath();ctx.moveTo(29,-3);ctx.lineTo(40,0);ctx.lineTo(29,4);ctx.lineTo(32,0);ctx.closePath();ctx.fill();}
  ctx.restore();
  if((look.hit??0)>0){ctx.globalAlpha=Math.min(.7,look.hit!);ctx.fillStyle='#fff0e9';ctx.beginPath();ctx.ellipse(0,-4,13,20,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
