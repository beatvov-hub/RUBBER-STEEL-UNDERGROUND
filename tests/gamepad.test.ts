import test from 'node:test';
import assert from 'node:assert/strict';
import { stick, pressed } from '../src/gamepad';

test('gamepad sticks ignore drift and preserve direction within unit range', () => {
  assert.deepEqual(stick(.1, .1), { x: 0, y: 0 });
  const value = stick(1, 1);
  assert.ok(Math.abs(Math.hypot(value.x, value.y) - 1) < 1e-9);
  assert.equal(value.x, value.y);
});
test('gamepad trigger supports analog and digital buttons', () => {
  const pad = { buttons: [{ pressed: false, value: .8 }, { pressed: true, value: 0 }] } as unknown as Gamepad;
  assert.equal(pressed(pad, 0), true);
  assert.equal(pressed(pad, 1), true);
  assert.equal(pressed(pad, 2), false);
});
