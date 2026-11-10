import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createTestTarget } from './test-server.mjs';
const target = await createTestTarget();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.padState = { axes: [0, 0, 0, 0], buttons: Array(16).fill(0) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [{ connected: true, mapping: 'standard', axes: window.padState.axes, buttons: window.padState.buttons.map(value => ({ pressed: value > .5, value })) }] });
  });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(target.url); await page.waitForTimeout(500);
  const button = async index => { await page.evaluate(i => window.padState.buttons[i] = 1, index); await page.waitForTimeout(100); await page.evaluate(i => window.padState.buttons[i] = 0, index); await page.waitForTimeout(100); };
  await button(0); await expect(page.locator('#start')).toBeFocused();
  await button(0); await expect(page.locator('#overlay')).toHaveClass(/playing/);
  await button(5); await expect(page.locator('#weapon')).toHaveText('TRIPLE SHOT');
  await page.evaluate(() => { window.padState.axes[2] = 1; window.padState.buttons[7] = 1; });
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.padState.buttons[7] = 0; window.padState.axes[2] = 0; });
  assert.notEqual(await page.locator('#rounds').textContent(), '000 / 180');
  await button(9); await expect(page.locator('#resume')).toBeVisible();
  await button(0); await expect(page.locator('#resume')).toBeFocused();
  await button(0); await expect(page.locator('#overlay')).toHaveClass(/playing/);
  assert.deepEqual(errors, []);
  console.log('Gamepad smoke PASS: menu, start, weapon, aim, fire and pause.');
} finally { await browser?.close(); await target.close(); }
