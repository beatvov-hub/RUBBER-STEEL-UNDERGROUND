import type { Ability } from '../data';
const paths:Record<Ability,string>={
  magnet:'<path d="M6 4v9a6 6 0 0 0 12 0V4M6 8h4M14 8h4M10 4v9a2 2 0 0 0 4 0V4"/>',
  slow:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l-3 3M2 5h4M1 10h3"/>',
  target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  move:'<path d="m13 3 4 5-4 5M4 8h13M10 13l4 5-4 4M2 18h12"/>',
  armor:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4ZM7 12h10m-4-4 4 4-4 4"/>',
  power:'<path d="M5 16 17 4l3 3L8 19H5v-3ZM3 22l3-3M4 7h5M7 4v6M15 17h6M18 14v6"/>',
  trigger:'<path d="M4 7h16v6H4zM8 13l3 8h4M15 13l-2 4M9 4v3M16 4v3"/>',
  salvo:'<path d="M3 7h12M3 12h17M3 17h12M15 4l6 8-6 8"/>',
  spread:'<path d="M4 12h8m0 0 8-7m-8 7 8 7m-8-7 8 0"/>',
  mass:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  stride:'<path d="M5 18l5-9 4 2 2 7M4 20h7M14 20h7M9 8l3-4 4 2"/>',
  strafe:'<path d="M4 4h6l-3 3M4 4l5 5M20 20h-6l3-3M20 20l-5-5M8 16l8-8"/>',
  exit:'<path d="M11 3h9v18h-9M4 12h13m-5-5 5 5-5 5M4 4v16"/>',
  coolant:'<path d="M12 2v20M4 6l16 12M20 6 4 18M3 12h18"/>',
  pilot:'<path d="M2 12h20M12 2v20M6 6l12 12M18 6 6 18"/><circle cx="12" cy="12" r="4"/>',
  breach:'<path d="M12 2 20 6v7c0 4-8 9-8 9S4 17 4 13V6l8-4ZM6 12h12M12 6v12"/>',
  control:'<path d="m5 4 4 4-4 4M9 8h7a4 4 0 1 1 0 8H8m4-4-4 4 4 4"/>',
  boss:'<path d="M4 5h16v14H4zM8 5v-3m8 3V2M7 13h10M12 8v10"/>',
};
export function abilityIcon(id:Ability){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;}
export const ABILITY_SUMMARIES:Record<Ability,string>={
  magnet:'敵の近くで、自弾がわずかに曲がる。',slow:'自弾の速度 −15%。戻り弾を読みやすく。',target:'敵の被弾半径 +20%。一発を確実に。',move:'移動速度 +15%。逃げ道へ先回り。',armor:'アーマー反射弾の速度 −25%。',power:'重弾ダメージ +2。初弾反射は残る。',
  trigger:'全武器の射撃間隔 −10%。',salvo:'TRIPLE SHOTの射撃間隔 −15%。',spread:'TRIPLE SHOTの左右角度を拡大。',mass:'重弾が大きくなる。自分も避けにくい。',stride:'移動速度 +10%。',strafe:'射撃中の移動速度 +12%。',exit:'敵全滅後の移動速度 +20%。',coolant:'初回反射で自弾速度 −10%。',pilot:'発射後1秒は敵の被弾半径 +10%。',breach:'装甲敵の被弾半径 +15%。',control:'装甲反射弾の速度をさらに −10%。',boss:'反射前の弾がボスへ当たるとダメージ +1。',
};
