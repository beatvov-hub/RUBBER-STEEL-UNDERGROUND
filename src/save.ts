import type { CharacterId } from './data';
export type Settings = { master: number; bgm: number; sfx: number; shake: number; flash: number; keyGuide: boolean };
export type SaveData = { version: 2; reachedStage: number; completedStages: number[]; unlocked: CharacterId[]; selected: CharacterId; settings: Settings; totalSeconds: number; bestByStage: Record<string,number>; bestFloor: number; deaths: number };
export const STORAGE_KEY='rsu-save';
export const DEFAULT_SAVE:SaveData={version:2,reachedStage:1,completedStages:[],unlocked:['standard'],selected:'standard',settings:{master:1,bgm:.45,sfx:.7,shake:.7,flash:.8,keyGuide:true},totalSeconds:0,bestByStage:{},bestFloor:1,deaths:0};
const number=(value:unknown,fallback:number,min=0,max=Infinity)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const index=(value:unknown,max:number)=>Number.isInteger(value)&&Number(value)>=1&&Number(value)<=max?Number(value):undefined;
const unlockFor=(stage:number):CharacterId[]=>stage>=30?['standard','fire','ice','thunder']:stage>=20?['standard','fire','ice']:stage>=10?['standard','fire']:['standard'];
export function migrateSave(value:unknown):SaveData {
  const obj=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const stage=index(obj.reachedStage,50)??1;
  const completed=Array.isArray(obj.completedStages)?[...new Set(obj.completedStages.map(x=>index(x,50)).filter((x):x is number=>x!==undefined))].sort((a,b)=>a-b):[];
  // Old saves had reachedStage but no cleared-stage list. Preserve their stage progress.
  if(obj.version===1)for(let s=1;s<stage;s++)if(!completed.includes(s))completed.push(s);
  if(obj.version===1&&typeof obj.bestSeconds==='number'&&Number.isFinite(obj.bestSeconds)&&!completed.includes(1))completed.push(1);
  completed.sort((a,b)=>a-b);
  const highest=Math.max(0,...completed),reachedStage=Math.max(stage,Math.min(50,highest+1));
  const oldUnlocked=Array.isArray(obj.unlocked)?obj.unlocked.filter(x=>['standard','fire','ice','thunder'].includes(x)) as CharacterId[]:[];
  const inferred=unlockFor(highest),unlocked=[...new Set<CharacterId>(['standard',...inferred,...oldUnlocked])];
  const oldSettings=obj.settings&&typeof obj.settings==='object'?obj.settings as Record<string,unknown>:{};
  const legacyMute=obj.version===1&&obj.muted===true;
  const settings:Settings={master:number(oldSettings.master,legacyMute?0:1,0,1),bgm:number(oldSettings.bgm,.45,0,1),sfx:number(oldSettings.sfx,.7,0,1),shake:number(oldSettings.shake,.7,0,1),flash:number(oldSettings.flash,.8,0,1),keyGuide:typeof oldSettings.keyGuide==='boolean'?oldSettings.keyGuide:true};
  const bestByStage:Record<string,number>={};
  if(obj.bestByStage&&typeof obj.bestByStage==='object')for(const [key,value] of Object.entries(obj.bestByStage)){const s=index(Number(key),50);if(s)bestByStage[s]=number(value,Infinity,0,1e9);}
  if(obj.version===1&&typeof obj.bestSeconds==='number'&&Number.isFinite(obj.bestSeconds))bestByStage['1']=number(obj.bestSeconds,Infinity,0,1e9);
  const selected=unlocked.includes(obj.selected as CharacterId)?obj.selected as CharacterId:'standard';
  return {version:2,reachedStage,completedStages:completed,unlocked,selected,settings,totalSeconds:number(obj.totalSeconds,0,0,1e12),bestByStage,bestFloor:number(obj.bestFloor,1,1,10),deaths:number(obj.deaths,0,0,1e9)};
}
export function completeStage(save:SaveData,stage:number,seconds:number):SaveData {
  if(!index(stage,50))throw new RangeError('Invalid stage');
  const next=migrateSave(save);
  if(!next.completedStages.includes(stage))next.completedStages.push(stage);
  next.completedStages.sort((a,b)=>a-b);
  next.reachedStage=Math.max(next.reachedStage,Math.min(50,stage+1));
  next.unlocked=[...new Set<CharacterId>([...next.unlocked,...unlockFor(stage)])];
  next.bestByStage[stage]=Math.min(next.bestByStage[stage]??Infinity,number(seconds,Infinity,0,1e9));
  return next;
}
export function loadSave(storage:Pick<Storage,'getItem'>):SaveData {
  try{return migrateSave(JSON.parse(storage.getItem(STORAGE_KEY)??'null'));}catch{return migrateSave(null);}
}
export function persistSave(storage:Pick<Storage,'setItem'>,save:SaveData){try{storage.setItem(STORAGE_KEY,JSON.stringify(save));}catch{/* Private browsing or full quota must not block a run. */}}
