import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createTestTarget } from './test-server.mjs';
await mkdir('artifacts',{recursive:true});
const target=await createTestTarget();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${target.url}?debug=1`);
  assert.equal(await page.locator('#debug').count(),1);
  assert.equal(await page.locator('#debug-unlock').count(),0,'debug jumping must not persistently unlock progression');
  const saveBefore=await page.evaluate(()=>localStorage.getItem('rsu-save'));
  await page.locator('#debug-stage').fill('50');await page.locator('#debug-floor').fill('10');
  await page.locator('#debug-character').selectOption('thunder');await page.locator('#debug-invincible').check();await page.locator('#debug-hitboxes').check();
  await page.locator('#debug-jump').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('rsu-save')),saveBefore,'debug runs must not modify progression saves');
  await page.waitForTimeout(300);await page.screenshot({path:'artifacts/stage-50-floor-10.png'});
  assert.match(await page.locator('.facility-status').textContent(),/STAGE 50/);
  assert.match(await page.locator('#debug-stats').textContent(),/FLOOR 10/);
  assert.match(await page.locator('#debug-stats').textContent(),/FIRE S\/T\/H/);
  assert.match(await page.locator('#debug-stats').textContent(),/REBOUNDS S\/T\/H/);
  assert.match(await page.locator('#debug-stats').textContent(),/RENDER .*ms/);
  assert.match(await page.locator('.vital-label').textContent(),/THUNDER/);
  await page.locator('#debug-enemies').selectOption(['dasher','phase_shift','ricochet_gunner']);
  await page.locator('#debug-spawn-enemies').click();await page.waitForTimeout(200);
  const enemyStats=await page.locator('#debug-stats').textContent();
  for(const type of ['dasher','phase_shift','ricochet_gunner'])assert.ok(enemyStats.includes(type),`debug enemy test omitted ${type}: ${enemyStats}`);
  await page.screenshot({path:'artifacts/enemy-debug-test.png'});
  await page.locator('#debug-stage').fill('50');await page.locator('#debug-floor').fill('10');await page.locator('#debug-jump').click();
  await page.keyboard.press('2');
  const bounds=await page.locator('#game').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.48,bounds.y+bounds.height*.48);await page.mouse.down();
  const samples=[];const stopAt=Date.now()+8000;
  while(Date.now()<stopAt){
    const stats=await page.locator('#debug-stats').textContent(),perf=await page.locator('#perf').textContent();
    const render=stats.match(/RENDER ([\d.]+)ms/),fps=perf.match(/^(\d+) FPS/),rounds=stats.match(/BULLET (\d+)\/(\d+)/);
    if(render&&fps&&rounds)samples.push({render:Number(render[1]),fps:Number(fps[1]),bullets:Number(rounds[1]),cap:Number(rounds[2])});
    await page.waitForTimeout(200);
  }
  await page.mouse.up();
  assert.ok(samples.length>=20,`expected ongoing performance samples, got ${samples.length}`);
  const renders=samples.map(s=>s.render).sort((a,b)=>a-b),fpsValues=samples.map(s=>s.fps).sort((a,b)=>a-b);
  const percentile=(values,p)=>values[Math.min(values.length-1,Math.floor(values.length*p))];
  const peakBullets=Math.max(...samples.map(s=>s.bullets));
  console.log(`Stage 50 render sample: ${samples.length} samples / FPS median ${percentile(fpsValues,.5)} / p10 ${percentile(fpsValues,.1)} / render median ${percentile(renders,.5)}ms / p95 ${percentile(renders,.95)}ms / peak bullets ${peakBullets}/${samples[0].cap}.`);
  for(const [stage,floor,name] of [[31,2,'stage-31-floor-2'],[30,10,'stage-30-boss'],[40,4,'stage-40-floor-4']]){
    await page.locator('#debug-stage').fill(String(stage));await page.locator('#debug-floor').fill(String(floor));await page.locator('#debug-jump').click();await page.waitForTimeout(300);
    const stats=await page.locator('#debug-stats').textContent();assert.match(stats,new RegExp(`STAGE ${stage} FLOOR ${floor}`));
    assert.match(stats,/ENEMY \d+\/\d+/);await page.screenshot({path:`artifacts/${name}.png`});
    console.log(`${name}: ${stats.match(/ENEMY \d+\/\d+/)?.[0]}`);
  }
  const normal=await browser.newPage();await normal.goto(target.url);assert.equal(await normal.locator('#debug').count(),0,'debug controls must require ?debug=1');
  await normal.locator('#stage-select').click();assert.equal(await normal.locator('[data-stage="50"]').isDisabled(),true,'normal stage progression must remain locked');
  assert.deepEqual(errors,[]);console.log('Debug mode PASS: stage/floor jump, individual and combined enemy test spawning, character, invincibility, hitboxes and stats controls; normal progression remains locked and debug saves are unchanged.');
}finally{await browser?.close();await target.close();}
