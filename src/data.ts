export type Vec = { x: number; y: number };
export type Rect = Vec & { w: number; h: number };
export type Weapon = 'standard' | 'triple' | 'heavy';
export type EnemyType = 'basic' | 'shooter' | 'armored' | 'boss';
export const CONFIG = {
  width: 1120, height: 640, fixedStep: 1 / 120, playerSpeed: 205,
  playerRadius: 12, playerHP: 1, bulletSpeed: 285, bulletRadius: 4,
  maxBullets: 180, enemyBulletLifetime: 6, reflectionVolume: .035,
  abilityFloors: [2, 4, 6, 8],
};
export const CHARACTERS = [{ id: 'standard', name: 'STANDARD', speed: CONFIG.playerSpeed, hp: CONFIG.playerHP, onHit: 'none' }];
export const WEAPONS: Record<Weapon, { name: string; speed: number; radius: number; cooldown: number; angles: number[]; damage: number }> = {
  standard: { name: 'STANDARD', speed: CONFIG.bulletSpeed, radius: 4, cooldown: .4, angles: [0], damage: 1 },
  triple: { name: 'TRIPLE SHOT', speed: CONFIG.bulletSpeed, radius: 4, cooldown: .65, angles: [-.19, 0, .19], damage: 1 },
  heavy: { name: 'HEAVY SHOT', speed: 220, radius: 8, cooldown: .8, angles: [0], damage: 2 },
};
export const ABILITIES = [
  { id: 'magnet', name: 'AIM MAGNET', label: '照準補助', text: '敵の近くを通る自弾が、少しだけ敵へ曲がる。' },
  { id: 'slow', name: 'SLOW BULLET', label: '弾速制御', text: '自弾の速度 −15%。火力はそのまま、戻る弾を読みやすく。' },
  { id: 'target', name: 'BIG TARGET', label: '標的拡張', text: '敵の被弾半径 +20%。慎重な一発を当てやすく。' },
  { id: 'move', name: 'MOVE SPEED', label: '機動力', text: '移動速度 +15%。逃げ道へ先にたどり着く。' },
  { id: 'armor', name: 'ARMOR BREAK CONTROL', label: '反射制御', text: 'アーマーで反射した自弾の速度 −25%。' },
  { id: 'power', name: 'HEAVY POWER', label: '重弾強化', text: 'HEAVY SHOTのダメージ +2。初弾のアーマー反射は残る。' },
] as const;
export type Ability = typeof ABILITIES[number]['id'];
export type Floor = { name: string; template: string; bounds: Rect; walls: Rect[]; enemies: { type: EnemyType; x: number; y: number }[]; hazards: { type: string; warningSeconds: number }[] };
const wall = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const spawn = (type: EnemyType, x: number, y: number) => ({ type, x, y });
const layouts = [
  [], [wall(515, 245, 85, 140)], [wall(390, 170, 70, 150), wall(740, 365, 70, 150)],
  [wall(400, 220, 75, 75), wall(700, 400, 75, 75)],
  [wall(345, 150, 60, 250), wall(690, 350, 220, 55)],
  [wall(350, 200, 65, 65), wall(650, 200, 65, 65), wall(500, 410, 65, 65), wall(850, 410, 65, 65)],
  [wall(380, 160, 55, 300), wall(700, 280, 55, 240)],
  [wall(280, 190, 240, 50), wall(620, 400, 250, 50)],
  [wall(300, 120, 50, 300), wall(520, 370, 50, 200), wall(730, 100, 50, 220)],
  [wall(330, 230, 65, 65), wall(330, 440, 65, 65), wall(750, 230, 65, 65), wall(750, 440, 65, 65)],
];
export const FLOORS: Floor[] = layouts.map((walls, i) => ({
  name: ['CALIBRATION BAY', 'RETURN PATH', 'FALSE SECURITY', 'PILLAR ARRAY', 'LIVE FIRE', 'REFLECTION LAB', 'ARMORED SECTOR', 'CROSS TRAFFIC', 'NO CLEAN SHOT', 'THE REFLECTOR'][i],
  template: ['SMALL_ROOM', 'SMALL_ROOM', 'OPEN_ROOM', 'PILLAR_ROOM', 'NARROW_ROOM', 'PILLAR_ROOM', 'NARROW_ROOM', 'CROSS_ROOM', 'MAZE_ROOM', 'OPEN_ROOM'][i],
  bounds: i < 3 ? wall(170, 85, 780, 480) : wall(48, 48, 1024, 544), walls,
  enemies: i === 9 ? [spawn('boss', 830, 160)] : [
    spawn('basic', 800, 170), ...(i > 0 ? [spawn('basic', 650, 330)] : []),
    ...(i > 1 ? [spawn('basic', 860, 530)] : []),
    ...(i >= 3 ? [spawn('shooter', 560, 115)] : []),
    ...(i >= 6 ? [spawn('armored', 930, 350)] : []),
    ...(i >= 7 ? [spawn('armored', 600, 520)] : []),
  ], hazards: [],
}));
