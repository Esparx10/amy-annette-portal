import { chromium } from 'playwright-core';
const angles = (process.argv[2] || '-0.62').split(',').map(Number);
const W = +(process.argv[3]||1280), H = +(process.argv[4]||800);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const logs=[]; p.on('console', m => logs.push(m.type()+': '+m.text())); p.on('pageerror', e => logs.push('ERR '+e.message));
await p.goto('file://' + process.cwd() + '/dist/' + (process.env.PAGE || 'stained-glass-earrings') + '.html', { timeout: 240000 });
await p.waitForFunction(() => window.__art, null, { timeout: 120000 });
await p.evaluate(() => window.__art.setPlaying(false));
console.log(JSON.stringify(await p.evaluate(() => window.__art.info())));
const dist = process.env.DIST ? +process.env.DIST : 0;
if (dist) await p.evaluate(d => window.__art.setDist(d), dist);
for (const a of angles) {
  await p.evaluate(a => { window.__art.setAngle(a); window.__art.render(); }, a);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/${process.env.TAG||'a'}_${a.toFixed(2)}_${W}x${H}.png` });
}
if (process.argv[5]) { // zoom shot
  await p.evaluate(() => { const c = document.querySelector('canvas'); });
}
console.log(logs.slice(0,10).join(' | '));
await b.close();
