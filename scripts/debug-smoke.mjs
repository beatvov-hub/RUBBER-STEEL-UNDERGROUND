import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/?debug=1');
  assert.equal(await page.locator('#debug').count(),1);
  await page.locator('#debug-stage').fill('50');await page.locator('#debug-floor').fill('10');
  await page.locator('#debug-character').selectOption('thunder');await page.locator('#debug-invincible').check();await page.locator('#debug-hitboxes').check();
  await page.locator('#debug-jump').click();
  assert.match(await page.locator('.facility-status').textContent(),/STAGE 50/);
  assert.match(await page.locator('#debug-stats').textContent(),/FLOOR 10/);
  assert.match(await page.locator('.vital-label').textContent(),/THUNDER/);
  assert.deepEqual(errors,[]);console.log('Development debug PASS: stage/floor jump, character, invincibility, hitboxes and stats controls.');
}finally{await browser.close();}
