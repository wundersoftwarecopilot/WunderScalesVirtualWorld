import { expect, openArtifact, test } from './fixture';

const benign = (e: string) => /GPU stall|swiftshader|WebGL-|Automatic fallback|deprecated/i.test(e);

test('the world boots, renders, and shows no text', async ({ page }) => {
  const errors: string[] = [];
  await openArtifact(page, errors);

  // No visible text anywhere in the page: everything is drawn in WebGL.
  const text = await page.evaluate(() => document.body.innerText.trim());
  expect(text).toBe('');

  // The canvas is not blank: sample pixels and expect some variety.
  await page.waitForTimeout(1500);
  const shot = await page.screenshot();
  expect(shot.byteLength).toBeGreaterThan(20_000);

  const scales = await page.evaluate(() => window.__wunder!.scales.map((s) => ({ id: s.spec.id, line: s.spec.line, placement: s.spec.placement })));
  expect(scales).toHaveLength(30);
  for (const line of ['medicale', 'industriale', 'design']) expect(scales.filter((s) => s.line === line)).toHaveLength(10);

  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test('arrow keys move the visitor and walls stop them', async ({ page }) => {
  const errors: string[] = [];
  await openArtifact(page, errors);
  const before = await page.evaluate(() => ({ x: window.__wunder!.player.x, z: window.__wunder!.player.z }));
  await page.locator('#gl').focus();
  // SwiftShader renders slowly and the frame step is capped, so wait on the position rather
  // than on wall-clock time.
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction((z0) => window.__wunder!.player.z < z0 - 0.5, before.z, { timeout: 60_000 });
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => ({ x: window.__wunder!.player.x, z: window.__wunder!.player.z }));
  expect(after.z).toBeLessThan(before.z - 0.5); // walked north towards the building

  // Turning with the side arrows changes the heading.
  const yaw0 = await page.evaluate(() => window.__wunder!.player.yaw);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((y0) => window.__wunder!.player.yaw > y0 + 0.2, yaw0, { timeout: 60_000 });
  await page.keyboard.up('ArrowLeft');

  // Walk into the lobby's west wall (away from the doorway): the wall must hold.
  await page.evaluate(() => window.__wunder!.player.teleport(-8.5, 13, Math.PI / 2));
  await page.keyboard.down('ArrowUp');
  const f0 = await page.evaluate(() => window.__wunder!.frames);
  await page.waitForFunction((f) => window.__wunder!.frames > f + 60, f0, { timeout: 120_000 });
  await page.keyboard.up('ArrowUp');
  const x = await page.evaluate(() => window.__wunder!.player.x);
  expect(x).toBeGreaterThan(-10 + 0.15);
});

test('logos become real links to the Wunder sites', async ({ page }) => {
  const errors: string[] = [];
  await openArtifact(page, errors);
  await page.evaluate(() => window.__wunder!.teleport('facade'));
  await page.waitForTimeout(1500);
  const hrefs = await page.$$eval('#links a:not([hidden])', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toContain('https://www.wunder.it/');
  for (const a of await page.$$('#links a')) {
    expect(await a.getAttribute('target')).toBe('_blank');
    expect((await a.innerText()).trim()).toBe('');
  }
  const all = await page.evaluate(() => window.__wunder!.links.links.map((l) => l.url));
  expect(all.some((u) => u.startsWith('https://medicale.wunder.it/'))).toBe(true);
  expect(all.some((u) => u.startsWith('https://industriale.wunder.it/'))).toBe(true);
  expect(all.some((u) => u.startsWith('https://design.wunder.it/'))).toBe(true);
});

test('stepping on a floor scale starts a weighing', async ({ page }) => {
  const errors: string[] = [];
  await openArtifact(page, errors);
  const target = await page.evaluate(() => {
    const s = window.__wunder!.scales.find((p) => p.instance.standOn && p.spec.placement === 'floor');
    return s ? { id: s.spec.id, x: s.slot.x, z: s.slot.z, rotY: s.slot.rotY, so: s.instance.standOn } : null;
  });
  expect(target).not.toBeNull();
  await page.evaluate((t) => {
    // Stand on the platform centre (local → world).
    const c = Math.cos(t!.rotY);
    const s = Math.sin(t!.rotY);
    const x = t!.x + t!.so!.x * c + t!.so!.z * s;
    const z = t!.z - t!.so!.x * s + t!.so!.z * c;
    window.__wunder!.player.teleport(x, z, t!.rotY + Math.PI);
  }, target);
  await page.waitForTimeout(800);
  const active = await page.evaluate((id) => window.__wunder!.scales.find((p) => p.spec.id === id)!.active, target!.id);
  expect(active).toBe(true);
  expect(await page.evaluate(() => window.__wunder!.player.floorTarget)).toBeGreaterThan(0);
});
