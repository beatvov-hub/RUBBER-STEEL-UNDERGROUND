import type { EnemyType } from './types';

export type EnemyCategory = 'legacy' | 'movement' | 'defense' | 'shooter' | 'bullet' | 'environment' | 'special';
export type EnemyDefinition = {
  id: EnemyType;
  name: string;
  category: EnemyCategory;
  unlockStage: number;
  hp: number;
  radius: number;
  speed: number;
  color: string;
  maxPerFloor: number;
};

/** Shared content data; movement and combat remain in behavior modules. */
export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  basic: {id:'basic',name:'BASIC',category:'legacy',unlockStage:1,hp:1,radius:15,speed:50,color:'#c77966',maxPerFloor:18},
  shooter: {id:'shooter',name:'SHOOTER',category:'legacy',unlockStage:4,hp:1,radius:15,speed:0,color:'#df986f',maxPerFloor:8},
  armored: {id:'armored',name:'ARMORED',category:'legacy',unlockStage:7,hp:2,radius:15,speed:38,color:'#a9d5e3',maxPerFloor:18},
  boss: {id:'boss',name:'BOSS',category:'legacy',unlockStage:10,hp:8,radius:33,speed:28,color:'#f18d74',maxPerFloor:1},
  dasher: {id:'dasher',name:'DASHER',category:'movement',unlockStage:7,hp:1,radius:15,speed:30,color:'#ff7565',maxPerFloor:2},
  flanker: {id:'flanker',name:'FLANKER',category:'movement',unlockStage:11,hp:1,radius:15,speed:46,color:'#d3b777',maxPerFloor:3},
  trigger_hound: {id:'trigger_hound',name:'TRIGGER HOUND',category:'movement',unlockStage:13,hp:1,radius:15,speed:31,color:'#ff9271',maxPerFloor:3},
  pack_runner: {id:'pack_runner',name:'PACK RUNNER',category:'movement',unlockStage:5,hp:1,radius:14,speed:42,color:'#e2a474',maxPerFloor:5},
  hopper: {id:'hopper',name:'HOPPER',category:'movement',unlockStage:21,hp:1,radius:14,speed:39,color:'#d6ca84',maxPerFloor:3},
  zigzag: {id:'zigzag',name:'ZIGZAG',category:'movement',unlockStage:3,hp:1,radius:15,speed:45,color:'#a9ccaa',maxPerFloor:4},
  front_shield: {id:'front_shield',name:'FRONT SHIELD',category:'defense',unlockStage:12,hp:2,radius:18,speed:28,color:'#9fc2cf',maxPerFloor:2},
  phase_shift: {id:'phase_shift',name:'PHASE SHIFT',category:'defense',unlockStage:21,hp:1,radius:15,speed:38,color:'#a9b9e8',maxPerFloor:2},
  splitter: {id:'splitter',name:'SPLITTER',category:'defense',unlockStage:22,hp:1,radius:16,speed:32,color:'#dc9da2',maxPerFloor:2},
  repair_bot: {id:'repair_bot',name:'REPAIR BOT',category:'defense',unlockStage:14,hp:2,radius:15,speed:25,color:'#9fd0bb',maxPerFloor:1},
  decoy_projector: {id:'decoy_projector',name:'DECOY PROJECTOR',category:'defense',unlockStage:23,hp:2,radius:16,speed:20,color:'#b9a7dc',maxPerFloor:1},
  hunker: {id:'hunker',name:'HUNKER',category:'defense',unlockStage:15,hp:5,radius:20,speed:8,color:'#b2aa9b',maxPerFloor:2},
  burst_gunner: {id:'burst_gunner',name:'BURST GUNNER',category:'shooter',unlockStage:16,hp:1,radius:15,speed:0,color:'#e18b72',maxPerFloor:2},
  tracking_sniper: {id:'tracking_sniper',name:'TRACKING SNIPER',category:'shooter',unlockStage:17,hp:1,radius:15,speed:0,color:'#d9899a',maxPerFloor:2},
  mortar: {id:'mortar',name:'MORTAR',category:'shooter',unlockStage:24,hp:2,radius:16,speed:0,color:'#d59e79',maxPerFloor:2},
  shockwaver: {id:'shockwaver',name:'SHOCKWAVER',category:'shooter',unlockStage:25,hp:2,radius:17,speed:12,color:'#dfbc77',maxPerFloor:1},
  arc_launcher: {id:'arc_launcher',name:'ARC LAUNCHER',category:'shooter',unlockStage:26,hp:2,radius:16,speed:0,color:'#a9bfe0',maxPerFloor:2},
  mine_layer: {id:'mine_layer',name:'MINE LAYER',category:'shooter',unlockStage:18,hp:2,radius:16,speed:25,color:'#db9875',maxPerFloor:2},
  magnetizer: {id:'magnetizer',name:'MAGNETIZER',category:'bullet',unlockStage:31,hp:2,radius:16,speed:24,color:'#b5a6db',maxPerFloor:2},
  accelerator: {id:'accelerator',name:'ACCELERATOR',category:'bullet',unlockStage:32,hp:2,radius:16,speed:22,color:'#e7a86e',maxPerFloor:2},
  slow_field: {id:'slow_field',name:'SLOW FIELD',category:'bullet',unlockStage:27,hp:2,radius:17,speed:18,color:'#83b8c8',maxPerFloor:1},
  prism_splitter: {id:'prism_splitter',name:'PRISM SPLITTER',category:'bullet',unlockStage:33,hp:2,radius:16,speed:22,color:'#b2a9e4',maxPerFloor:1},
  moving_mirror: {id:'moving_mirror',name:'MOVING MIRROR',category:'bullet',unlockStage:34,hp:3,radius:17,speed:20,color:'#9ed3d8',maxPerFloor:2},
  bullet_orbiter: {id:'bullet_orbiter',name:'BULLET ORBITER',category:'bullet',unlockStage:41,hp:3,radius:17,speed:18,color:'#c4a2df',maxPerFloor:1},
  wall_builder: {id:'wall_builder',name:'WALL BUILDER',category:'environment',unlockStage:35,hp:2,radius:16,speed:16,color:'#c5a179',maxPerFloor:1},
  shutter_operator: {id:'shutter_operator',name:'SHUTTER OPERATOR',category:'environment',unlockStage:36,hp:2,radius:16,speed:16,color:'#d49682',maxPerFloor:1},
  reinforcement_beacon: {id:'reinforcement_beacon',name:'REINFORCEMENT BEACON',category:'environment',unlockStage:37,hp:2,radius:18,speed:0,color:'#e7ad68',maxPerFloor:1},
  squad_commander: {id:'squad_commander',name:'SQUAD COMMANDER',category:'environment',unlockStage:38,hp:2,radius:17,speed:24,color:'#cf8f90',maxPerFloor:1},
  tether_guard: {id:'tether_guard',name:'TETHER GUARD',category:'environment',unlockStage:41,hp:2,radius:16,speed:27,color:'#e4a2af',maxPerFloor:2},
  echo_stalker: {id:'echo_stalker',name:'ECHO STALKER',category:'environment',unlockStage:42,hp:2,radius:16,speed:31,color:'#bda9d9',maxPerFloor:2},
  triple_gunner: {id:'triple_gunner',name:'TRIPLE GUNNER',category:'shooter',unlockStage:9,hp:1,radius:15,speed:0,color:'#e7826e',maxPerFloor:2},
  ricochet_gunner: {id:'ricochet_gunner',name:'RICOCHET GUNNER',category:'shooter',unlockStage:28,hp:2,radius:16,speed:0,color:'#96c6d8',maxPerFloor:2},
  bomber: {id:'bomber',name:'CLUSTER BOMBER',category:'special',unlockStage:13,hp:1,radius:14,speed:34,color:'#f19a68',maxPerFloor:1},
  guardian: {id:'guardian',name:'GUARDIAN',category:'special',unlockStage:16,hp:3,radius:17,speed:16,color:'#7fc9bd',maxPerFloor:1},
  sentinel: {id:'sentinel',name:'SENTINEL',category:'special',unlockStage:18,hp:2,radius:17,speed:0,color:'#e5bd72',maxPerFloor:1},
  duelist: {id:'duelist',name:'DUELIST',category:'special',unlockStage:21,hp:2,radius:15,speed:46,color:'#d69aa6',maxPerFloor:1},
  webber: {id:'webber',name:'WEBBER',category:'special',unlockStage:24,hp:2,radius:16,speed:20,color:'#a7c982',maxPerFloor:1},
  burrower: {id:'burrower',name:'BURROWER',category:'special',unlockStage:27,hp:2,radius:15,speed:32,color:'#cc9d70',maxPerFloor:1},
  siege_cannon: {id:'siege_cannon',name:'SIEGE CANNON',category:'special',unlockStage:30,hp:3,radius:18,speed:0,color:'#d38d79',maxPerFloor:1},
  reanimator: {id:'reanimator',name:'REANIMATOR',category:'special',unlockStage:33,hp:2,radius:17,speed:12,color:'#b69bd2',maxPerFloor:1},
  hive_caller: {id:'hive_caller',name:'HIVE CALLER',category:'special',unlockStage:37,hp:3,radius:17,speed:14,color:'#e2a56e',maxPerFloor:1},
  beam_weaver: {id:'beam_weaver',name:'BEAM WEAVER',category:'special',unlockStage:41,hp:2,radius:16,speed:0,color:'#e48a9f',maxPerFloor:1},
};

export function enemyDefinition(type: EnemyType) { return ENEMY_DEFINITIONS[type]; }

