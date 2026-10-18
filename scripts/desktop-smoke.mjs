import { _electron, expect } from '@playwright/test';
import { resolve } from 'node:path';
const app = await _electron.launch({ executablePath: resolve(process.env.RSU_DESKTOP_EXE ?? 'release/win-unpacked/RUBBER_STEEL_UNDERGROUND.exe'), args: [] });
try {
  const page = await app.firstWindow(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click(); await expect(page.locator('#exit')).toHaveText('LOCKED');
  await page.screenshot({path:'artifacts/windows-gameplay.png'});
  await page.keyboard.press('Escape');await expect(page.locator('#resume')).toBeVisible();
  await page.locator('#title').click();
  await page.addInitScript(() => { window.__rsuTrackPlays=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__rsuTrackPlays.push(this.currentSrc||this.src);return originalPlay.call(this);}; });
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('rsu-save')??'{}');save.version=2;save.reachedStage=50;save.completedStages=Array.from({length:49},(_,i)=>i+1);save.unlocked=['standard','fire','ice','thunder'];save.selected='thunder';localStorage.setItem('rsu-save',JSON.stringify(save));});
  await page.reload();await page.locator('#stage-select').click();await expect(page.locator('[data-stage="50"]')).toBeEnabled();await page.locator('[data-stage="50"]').click();
  await expect(page.locator('.facility-status')).toContainText('STAGE 50');await expect(page.locator('#enemies')).toHaveText('21');
  await page.waitForFunction(()=>window.__rsuTrackPlays.some(url=>/RSU-boss.*\.mp3/.test(url)));
  await page.screenshot({path:'artifacts/windows-stage-50.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Windows EXE smoke PASS: local packaged page loads, run starts, pause works, stage 50 unlock and boss BGM work.');
} finally { await app.close(); }
