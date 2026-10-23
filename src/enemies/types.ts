/** Stable save/debug/content identifiers for every enemy. */
export const ENEMY_TYPES = [
  'basic', 'shooter', 'armored', 'boss',
  'dasher', 'flanker', 'trigger_hound', 'pack_runner', 'hopper', 'zigzag',
  'front_shield', 'phase_shift', 'splitter', 'repair_bot', 'decoy_projector', 'hunker',
  'burst_gunner', 'tracking_sniper', 'mortar', 'shockwaver', 'arc_launcher', 'mine_layer',
  'magnetizer', 'accelerator', 'slow_field', 'prism_splitter', 'moving_mirror', 'bullet_orbiter',
  'wall_builder', 'shutter_operator', 'reinforcement_beacon', 'squad_commander', 'tether_guard', 'echo_stalker',
  'triple_gunner', 'ricochet_gunner',
  'bomber', 'burrower', 'sentinel', 'beam_weaver', 'guardian', 'hive_caller', 'webber', 'duelist', 'reanimator', 'siege_cannon',
] as const;

export type EnemyType = typeof ENEMY_TYPES[number];

export const NEW_ENEMY_TYPES = ENEMY_TYPES.slice(4) as readonly Exclude<EnemyType, 'basic' | 'shooter' | 'armored' | 'boss'>[];

