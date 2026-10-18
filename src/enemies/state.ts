import type { Vec } from '../data';

export type EnemyMode = 'approach' | 'windup' | 'dash' | 'recover' | 'hop' | 'phase' | 'repair' | 'burst' | 'aim' | 'fire' | 'cooldown';

/** Explicit per-instance behavior data; reset whenever a floor is loaded. */
export type EnemyBehaviorState = {
  mode?: EnemyMode;
  modeTime?: number;
  heading?: Vec;
  landing?: Vec;
  flankSide?: -1 | 1;
  triggerBoost?: number;
  packBoost?: number;
  phaseTime?: number;
  lastAction?: number;
  shotsLeft?: number;
  targetEnemyId?: number;
  targetBulletId?: number;
  fieldTime?: number;
  used?: boolean;
  alerted?: boolean;
  hopOverSmallWall?: boolean;
  mirror?:Vec;
};

