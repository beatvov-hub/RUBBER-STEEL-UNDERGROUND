import type { Vec } from './data';

const DEADZONE = .22;
export function stick(x: number, y: number): Vec {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DEADZONE) return { x: 0, y: 0 };
  const scaled = Math.min(1, (magnitude - DEADZONE) / (1 - DEADZONE)) / magnitude;
  return { x: x * scaled, y: y * scaled };
}
export function pressed(pad: Gamepad, index: number): boolean {
  const button = pad.buttons[index];
  return !!button && (button.pressed || button.value > .5);
}
