import { _electron, expect } from '@playwright/test';
import { resolve } from 'node:path';
const app = await _electron.launch({ executablePath: resolve('release/win-unpacked/RUBBER_STEEL_UNDERGROUND.exe'), args: [] });
try {
  const page = await app.firstWindow(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click(); await expect(page.locator('#exit')).toHaveText('LOCKED');
  await page.screenshot({path:'artifacts/windows-gameplay.png'});
  await page.keyboard.press('Escape');await expect(page.locator('#resume')).toBeVisible();
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Windows EXE smoke PASS: local packaged page loads, run starts, pause works.');
} finally { await app.close(); }
