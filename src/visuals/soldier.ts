import type { CharacterId, EnemyType, Weapon, Vec } from '../data';

/** Renderer contract: replace this function with a sprite-sheet adapter without touching physics. */
export type SoldierLook = {
  position: Vec; aim: number; move: Vec; time: number; running: boolean;
  role: 'player' | EnemyType;
  accent?: string; character?: CharacterId; armor?: boolean; weapon?: Weapon; recoil?: number; hit?: number; death?: number;
  alpha?:number;
};
export function shape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}
const ENEMY_SHELL: Partial<Record<EnemyType,string>> = {
  basic:'#76534b', shooter:'#59616a', armored:'#617783', boss:'#76514d', dasher:'#713e43', flanker:'#6c6044',
  trigger_hound:'#663f49', pack_runner:'#70513f', hopper:'#666044', zigzag:'#52694f', front_shield:'#526c79',
  phase_shift:'#545b82', splitter:'#704b57', repair_bot:'#456a5b', decoy_projector:'#5d5072', hunker:'#666258',
  burst_gunner:'#704a4a', tracking_sniper:'#69505e', mortar:'#70543f', shockwaver:'#71623f', arc_launcher:'#555b74',
  mine_layer:'#6c5144', magnetizer:'#62567a', accelerator:'#72533b', slow_field:'#466775', prism_splitter:'#625985',
  moving_mirror:'#456d70', bullet_orbiter:'#695578', wall_builder:'#705a40', shutter_operator:'#704f4a',
  reinforcement_beacon:'#755735', squad_commander:'#704b53', tether_guard:'#704c59', echo_stalker:'#5d5375',
  triple_gunner:'#744a41', ricochet_gunner:'#45616a',
};
export function drawSoldier(ctx: CanvasRenderingContext2D, look: SoldierLook) {
  const { position:p, role, aim, time } = look;
  const heavy = role === 'armored' || role === 'boss';
  const scale = role === 'boss' ? 1.85 : heavy ? 1.15 : 1;
  const player = role === 'player';
  const accent = look.accent ?? (player ? '#dce5cc' : role === 'armored' && look.armor ? '#a9d5e3' : '#ef836c');
  const olive = player ? look.character==='fire'?'#745649':look.character==='ice'?'#58717a':look.character==='thunder'?'#6b6951':'#68775b' : ENEMY_SHELL[role as EnemyType] ?? (heavy ? '#555e66' : '#775652');
  const dead = look.death ?? 0;
  ctx.save(); ctx.globalAlpha=look.alpha??1;ctx.translate(p.x,p.y);
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
  const packWidth = role==='hunker'||role==='boss'||role==='armored' ? 26 : role==='tracking_sniper'||role==='mortar'||role==='arc_launcher' ? 24 : 22;
  shape(ctx,-packWidth/2,-3,packWidth,19,role==='hunker'?3:5,'#18252b','#34454d');
  // Large role-coded pack modules create a readable outline at normal gameplay zoom.
  if(!player){
    if(['shooter','burst_gunner','tracking_sniper','triple_gunner','ricochet_gunner'].includes(role)){
      shape(ctx,-13,-1,5,15,2,'#26353d',accent);shape(ctx,-12,1,3,7,1,accent);
    }else if(['magnetizer','accelerator','slow_field','prism_splitter','moving_mirror','bullet_orbiter'].includes(role)){
      shape(ctx,-15,-5,6,20,3,'#26333d',accent);shape(ctx,9,-5,6,20,3,'#26333d',accent);
      ellipse(ctx,-12,0,1.7,1.7,accent);ellipse(ctx,12,0,1.7,1.7,accent);
    }else if(['wall_builder','shutter_operator','reinforcement_beacon','squad_commander','tether_guard','echo_stalker'].includes(role)){
      shape(ctx,-14,-2,6,19,2,'#26333d',accent);shape(ctx,8,-2,6,19,2,'#26333d',accent);
    }
  }
  if(player&&look.character==='fire'){shape(ctx,-15,-2,7,17,3,'#553b35',accent);shape(ctx,-16,2,3,11,1,'#a96149');}
  if(player&&look.character==='ice'){shape(ctx,-15,-5,8,18,3,'#2e505c',accent);shape(ctx,-17,1,3,9,1,'#9ed7ef');}
  if(player&&look.character==='thunder'){shape(ctx,-15,-4,8,19,3,'#4e4d3d',accent);shape(ctx,-16,-7,3,7,1,accent);}
  if(role==='shooter') { shape(ctx,-13,-5,8,20,3,'#414952','#76838a');ctx.strokeStyle='#778790';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(-12,-29);ctx.stroke();ellipse(ctx,-12,-29,1.5,1.5,'#ec8d73'); }
  shape(ctx,-9,-1,18,15,4,olive,'#aab4a5');
  shape(ctx,-6,2,12,9,2,'#29363a');
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
  const faceTone=player?'#bfad96':role==='repair_bot'||role==='decoy_projector'||role==='reinforcement_beacon'?'#778b88':'#9f8b80';
  shape(ctx,-9,-15,18,14,6,faceTone);
  const helmet=player?'#71816c':role==='phase_shift'||role==='echo_stalker'?'#536185':role==='front_shield'||role==='armored'?'#526c78':role==='tracking_sniper'?'#5e4b58':'#414e56';
  ctx.fillStyle=helmet;ctx.beginPath();ctx.ellipse(0,-17,12.5,9.5,0,Math.PI,Math.PI*2);ctx.lineTo(12.5,-12);ctx.quadraticCurveTo(0,-8,-12.5,-12);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#a0aca0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-17,11.5,8.5,0,Math.PI+.3,Math.PI*1.8);ctx.stroke();
  shape(ctx,-9,-14,18,5,2,'#101f28','#51656b');
  shape(ctx,Math.cos(aim)*3-5,-13,10,2,1,accent);
  shape(ctx,-3,-25,6,5,1,'#b7c2b4');shape(ctx,-2,-24,4,2,1,accent);
  if(player&&look.character==='fire'){shape(ctx,-8,-26,16,3,1,'#ad6750');shape(ctx,-4,-28,8,3,1,accent);}
  if(player&&look.character==='ice'){shape(ctx,-12,-21,24,5,2,'#8ebdcc');shape(ctx,-9,-14,18,4,2,'#c5eff5');}
  if(player&&look.character==='thunder'){shape(ctx,-2,-31,4,7,1,accent);ellipse(ctx,0,-32,2,2,'#fff1b4');}
  shape(ctx,-13,-16,4,9,2,'#222e33');shape(ctx,9,-16,4,9,2,'#222e33');
  if(role==='basic'){shape(ctx,-5,-4,10,3,1,'#b96958');}
  if(role==='front_shield'){
    // Forward slab and central brace read as a shield even when the gun is turned away.
    ctx.save();ctx.rotate(aim);shape(ctx,19,-12,8,25,3,'#334c58',accent);shape(ctx,21,-8,4,17,2,'#91b5c1');shape(ctx,20,-1,7,3,1,'#d5e9e8');ctx.restore();
  }
  if(role==='phase_shift'||role==='echo_stalker'){
    ctx.strokeStyle=role==='phase_shift'?'#c2d4ffcc':'#cbb9f0aa';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(0,-3,18,24,time*.7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }
  if(role==='armored'||role==='hunker'||role==='boss'){
    shape(ctx,-12,-8,24,7,2,role==='boss'?'#493338':'#3d4a50',accent);
    shape(ctx,-11,10,22,4,2,'#26333a','#a5b3b4');
  }
  if(role==='repair_bot'||role==='reinforcement_beacon'){
    shape(ctx,-4,-29,8,6,2,'#253b3c',accent);ellipse(ctx,0,-27,2,2,'#fff0b2');
  }
  if(role==='squad_commander'){
    ctx.strokeStyle='#ddc0a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,-18);ctx.lineTo(-16,-35);ctx.stroke();
    ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(-16,-35);ctx.lineTo(-7,-32);ctx.lineTo(-15,-28);ctx.closePath();ctx.fill();
  }
  if(role==='bullet_orbiter'){
    ctx.strokeStyle=`${accent}aa`;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-2,21,18,time*.6,0,Math.PI*2);ctx.stroke();
  }
  if(role==='dasher'){shape(ctx,-14,-22,28,5,2,'#54272c',accent);shape(ctx,-19,-3,7,5,2,accent);shape(ctx,12,-3,7,5,2,accent);}
  if(role==='flanker'){shape(ctx,-18,-8,6,15,3,'#464337',accent);shape(ctx,12,-8,6,15,3,'#464337',accent);}
  if(role==='trigger_hound'){shape(ctx,-13,-10,26,12,5,'#3e2929',accent);shape(ctx,-14,-18,5,7,2,accent);shape(ctx,9,-18,5,7,2,accent);}
  if(role==='pack_runner'){shape(ctx,-12,5,24,5,2,'#543a32',accent);shape(ctx,-16,5,5,7,2,accent);shape(ctx,11,5,5,7,2,accent);}
  if(role==='hopper'){shape(ctx,-15,-7,6,16,3,'#3d3b2b',accent);shape(ctx,9,-7,6,16,3,'#3d3b2b',accent);shape(ctx,-6,-25,12,4,2,accent);}
  if(role==='zigzag'){shape(ctx,-17,-11,5,20,2,accent);shape(ctx,12,-11,5,20,2,accent);}
  if(role==='splitter'){shape(ctx,-16,-6,6,14,3,'#51373c',accent);shape(ctx,10,-6,6,14,3,'#51373c',accent);shape(ctx,-4,-30,8,5,2,accent);}
  if(role==='repair_bot'){shape(ctx,-15,-9,6,14,2,'#315247',accent);shape(ctx,9,-9,6,14,2,'#315247',accent);shape(ctx,-3,-29,6,9,2,accent);}
  if(role==='decoy_projector'){ellipse(ctx,0,-2,15,16,`${accent}44`);shape(ctx,-13,-5,5,16,2,'#4e435c',accent);shape(ctx,8,-5,5,16,2,'#4e435c',accent);}
  if(role==='hunker'){shape(ctx,-18,-3,9,19,3,'#666159',accent);shape(ctx,9,-3,9,19,3,'#666159',accent);shape(ctx,-17,-19,34,8,4,'#555149','#d7c9aa');}
  if(role==='burst_gunner'){shape(ctx,5,-10,19,7,2,'#4c3940',accent);shape(ctx,20,-14,11,3,1,accent);}
  if(role==='tracking_sniper'){shape(ctx,5,-10,26,6,2,'#45323b',accent);shape(ctx,25,-12,13,2,1,accent);}
  if(role==='mortar'){shape(ctx,-18,-6,9,15,3,'#604737',accent);shape(ctx,-4,-28,8,15,3,'#4e4039',accent);}
  if(role==='shockwaver'){ellipse(ctx,0,1,21,20,`${accent}44`);shape(ctx,-4,-31,8,6,2,accent);}
  if(role==='arc_launcher'){shape(ctx,-14,-4,8,16,2,'#484252',accent);shape(ctx,7,-6,19,9,3,'#3d3d4a',accent);}
  if(role==='mine_layer'){shape(ctx,-18,5,8,8,3,'#443c38',accent);shape(ctx,10,5,8,8,3,'#443c38',accent);}
  if(role==='magnetizer'){shape(ctx,-20,-7,7,14,3,'#40374e',accent);shape(ctx,13,-7,7,14,3,'#40374e',accent);}
  if(role==='accelerator'){shape(ctx,-18,-4,6,15,2,'#544536',accent);shape(ctx,12,-4,6,15,2,'#544536',accent);shape(ctx,-4,-28,8,5,2,accent);}
  if(role==='slow_field'){ellipse(ctx,0,2,20,20,`${accent}33`);shape(ctx,-13,-4,5,12,2,'#33454e',accent);shape(ctx,8,-4,5,12,2,'#33454e',accent);}
  if(role==='prism_splitter'){ctx.save();ctx.rotate(Math.PI/4);shape(ctx,-9,-22,18,18,4,'#433f5c',accent);ctx.restore();}
  if(role==='moving_mirror'){shape(ctx,11,-18,7,36,2,'#45656b','#ddffff');}
  if(role==='bullet_orbiter'){for(let i=0;i<3;i++){const a=time*1.8+i*2.094;ellipse(ctx,Math.cos(a)*21,Math.sin(a)*18,3,3,accent);}}
  if(role==='wall_builder'){shape(ctx,-18,-7,8,21,3,'#56463a',accent);shape(ctx,10,-7,8,21,3,'#56463a',accent);}
  if(role==='shutter_operator'){shape(ctx,-19,-2,8,17,2,'#59453c',accent);shape(ctx,11,-2,8,17,2,'#59453c',accent);}
  if(role==='reinforcement_beacon'){shape(ctx,-4,-32,8,11,3,'#66513c',accent);ellipse(ctx,0,-29,3,3,'#fff0b2');}
  if(role==='squad_commander'){shape(ctx,-15,-20,30,6,2,'#594247',accent);shape(ctx,-3,-27,6,5,2,accent);}
  if(role==='tether_guard'){shape(ctx,-17,-4,7,16,3,'#593f48',accent);shape(ctx,10,-4,7,16,3,'#593f48',accent);}
  if(role==='echo_stalker'){ctx.globalAlpha=.5;shape(ctx,-13,-12,26,25,7,accent);ctx.globalAlpha=1;}
  if(role==='triple_gunner'){shape(ctx,4,-7,27,9,3,'#493a3a',accent);for(const y of[-4,0,4])shape(ctx,25,y-1,8,2,1,accent);}
  if(role==='ricochet_gunner'){shape(ctx,4,-7,26,9,3,'#334a52',accent);shape(ctx,26,-4,10,3,1,'#d9fbff');}
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
  }else if(role==='triple_gunner'){
    shape(ctx,2-kick,-5,20,10,3,'#3a3435','#b9a19a');shape(ctx,13-kick,-7,18,3,1,'#a98b81');shape(ctx,13-kick,-1.5,18,3,1,'#c7aaa0');shape(ctx,13-kick,4,18,3,1,'#a98b81');shape(ctx,7-kick,-3,8,6,2,'#282a2d',accent);
  }else if(role==='ricochet_gunner'){
    shape(ctx,2-kick,-5,20,10,3,'#2b414b','#91c7d8');shape(ctx,17-kick,-3,17,6,2,'#4d6770');shape(ctx,29-kick,-5,7,3,1,'#e4f9ff');shape(ctx,29-kick,2,7,3,1,'#e4f9ff');
  }else if(role==='tracking_sniper'){
    shape(ctx,1-kick,-5,22,10,3,'#3c333a','#bb8795');shape(ctx,18-kick,-2,25,4,1,'#aeb9c0');shape(ctx,8-kick,-9,8,4,1,'#282f37',accent);ellipse(ctx,12-kick,-7,1.4,1.4,'#d9f7ff');
  }else if(role==='burst_gunner'){
    shape(ctx,2-kick,-5,20,10,3,'#49343a','#c78375');shape(ctx,14-kick,-3,17,6,2,'#8f6259');ellipse(ctx,11-kick,7,4,5,'#31353a');shape(ctx,28-kick,-3,7,6,1,'#19232a');
  }else if(role==='mortar'){
    shape(ctx,1-kick,-6,18,12,3,'#493d35','#c99b70');shape(ctx,13-kick,-4,17,8,2,'#8b775d');shape(ctx,26-kick,-3,10,6,1,'#24282a');ellipse(ctx,33-kick,0,3,3,'#e2b482');
  }else if(role==='arc_launcher'){
    shape(ctx,1-kick,-6,20,12,3,'#3b3c50','#aab9e5');shape(ctx,16-kick,-4,17,8,2,'#55566e');shape(ctx,31-kick,-5,4,4,1,'#d7efff');shape(ctx,31-kick,2,4,4,1,'#d7efff');
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
