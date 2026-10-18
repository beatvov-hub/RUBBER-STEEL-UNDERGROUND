import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createTestTarget } from './test-server.mjs';

await mkdir('artifacts', { recursive: true });
const target = await createTestTarget();
let browser;
try {
browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => { throw error; });
await page.goto(target.url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.locator('#start').click();
await expect(page.locator('.touch-stick')).toBeVisible();
assert.match(await page.locator('.touch-instructions').textContent(), /左側ドラッグ.*右側ドラッグ/);
await page.waitForFunction(() => document.querySelector('#tutorial')?.textContent?.includes('左ドラッグ: 移動'), null, { timeout: 1500 });

const box = await page.locator('#game').boundingBox();
assert.ok(box);
const cdp = await context.newCDPSession(page);
const sendTouch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: points.map(({ id, x, y }) => ({ id, x, y, radiusX: 8, radiusY: 8, force: 1 })),
});
const left = { id: 1, x: box.x + box.width * .32, y: box.y + box.height * .7 };
await sendTouch('touchStart', [left]);
await sendTouch('touchMove', [{ ...left, x: left.x + 30, y: left.y - 18 }]);
await expect(page.locator('.touch-stick')).toHaveClass(/active/);
await page.waitForTimeout(250);
await sendTouch('touchEnd');
await expect(page.locator('.touch-stick')).not.toHaveClass(/active/);

const right = { id: 2, x: box.x + box.width * .8, y: box.y + box.height * .55 };
await sendTouch('touchStart', [right]);
await sendTouch('touchMove', [{ ...right, x: right.x - 14, y: right.y + 12 }]);
await page.waitForTimeout(500);
assert.ok(Number((await page.locator('#rounds').textContent()).split('/')[0].trim()) > 0, 'right-side drag should fire');
await sendTouch('touchEnd');
const triple = await page.locator('[data-weapon="triple"]').boundingBox();
assert.ok(triple && triple.width >= 40 && triple.height >= 44, 'weapon buttons should be touch-sized');
const weaponTap = { id: 3, x: triple.x + triple.width / 2, y: triple.y + triple.height / 2 };
await sendTouch('touchStart', [weaponTap]);
await sendTouch('touchEnd');
await expect(page.locator('#weapon')).toHaveText('TRIPLE SHOT');
await page.screenshot({ path: 'artifacts/mobile-gameplay.png', fullPage: true });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'mobile layout should not scroll horizontally');
console.log('Mobile smoke PASS: touch movement, drag aim/fire, HUD instructions, weapon controls and viewport fit.');
await browser.close();
browser = undefined;
} finally {
  await browser?.close();
  await target.close();
}
