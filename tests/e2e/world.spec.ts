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

  // Walk into the lobby's west wall (away from the doorway): the wall must hold. z = 14.5 is a
  // stretch of bare wall between the corner bench and the planter by the glass, so the visitor
  // reaches the wall itself (not a prop in front of it).
  await page.evaluate(() => window.__wunder!.player.teleport(-8.5, 14.5, Math.PI / 2));
  await page.keyboard.down('ArrowUp');
  const f0 = await page.evaluate(() => window.__wunder!.frames);
  await page.waitForFunction((f) => window.__wunder!.frames > f + 60, f0, { timeout: 120_000 });
  await page.keyboard.up('ArrowUp');
  const x = await page.evaluate(() => window.__wunder!.player.x);
  expect(x).toBeGreaterThan(-10 + 0.15); // not through the wall
  expect(x).toBeLessThan(-9.3); // but right up against it
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

test('walking onto a floor scale starts a weighing', async ({ page }) => {
  const errors: string[] = [];
  await openArtifact(page, errors);
  await page.locator('#gl').focus();
  // A medicale column scale (the platform is partly under its column) and the gallery hero.
  for (const id of ['r2020', 'r150-gold']) {
    const start = await page.evaluate((id) => {
      const s = window.__wunder!.scales.find((p) => p.spec.id === id);
      const so = s?.instance.standOn;
      if (!s || !so || s.spec.placement !== 'floor') return null;
      // Platform centre (local → world), then 1 m out in front of the platform's front edge,
      // facing the scale (front = local +Z; the visitor's yaw 0 looks towards −Z).
      const c = Math.cos(s.slot.rotY);
      const n = Math.sin(s.slot.rotY);
      const cx = s.slot.x + so.x * c + so.z * n;
      const cz = s.slot.z - so.x * n + so.z * c;
      const out = so.d / 2 + 1.0;
      return { x: cx + n * out, z: cz + c * out, yaw: s.slot.rotY };
    }, id);
    expect(start, id).not.toBeNull();
    await page.evaluate((s) => window.__wunder!.player.teleport(s!.x, s!.z, s!.yaw), start);
    const f0 = await page.evaluate(() => window.__wunder!.frames);
    await page.waitForFunction((f) => window.__wunder!.frames > f + 2, f0, { timeout: 60_000 });
    expect(await page.evaluate((id) => window.__wunder!.scales.find((p) => p.spec.id === id)!.active, id), id).toBe(false);
    // Walk forward until the platform weighs the visitor: a collider in the way would stop them
    // short of it and time out here.
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(
      (id) => window.__wunder!.scales.find((p) => p.spec.id === id)!.active && window.__wunder!.player.floorTarget > 0,
      id,
      { timeout: 90_000 },
    );
    await page.keyboard.up('ArrowUp');
  }
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

/**
 * Put a real logo link right under the forward arrow (the lobby floor logo, moved 1.5 m in front
 * of the camera along the ray through the arrow): independent of where the world's logos happen
 * to project, the arrow and a live <a> overlap. Returns the arrow's client coordinates.
 */
async function linkUnderForwardArrow(page: import('@playwright/test').Page): Promise<{ x: number; y: number }> {
  await page.evaluate(() => window.__wunder!.player.teleport(0, 11.5, 0, 0));
  const at = await page.evaluate(() => {
    const w = window.__wunder!;
    const p = w.hud.center('forward');
    const cam = w.scene.children.find((o) => (o as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) as import('three').PerspectiveCamera;
    cam.updateMatrixWorld();
    const V = cam.position.constructor as typeof import('three').Vector3;
    const ndc = new V((p.x / window.innerWidth) * 2 - 1, 1 - (p.y / window.innerHeight) * 2, 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    const link = w.links.links.find((l) => l.url === 'https://www.wunder.it/' && Math.abs(l.object.position.z - 12.85) < 0.05 && l.object.position.y < 0.05);
    if (!link) return null;
    link.object.position.copy(cam.position).addScaledVector(dir, 1.5);
    link.object.updateMatrixWorld(true);
    return p;
  });
  expect(at).not.toBeNull();
  // Let the link layer place the anchor over the moved logo.
  await page.waitForFunction(
    (p) => {
      const el = document.elementFromPoint(p.x, p.y);
      return el?.tagName === 'A' && (el as HTMLAnchorElement).href === 'https://www.wunder.it/';
    },
    at!,
    { timeout: 60_000 },
  );
  return at!;
}

test('pressing an on-screen arrow over a logo walks and does not open the link', async ({ page, context }) => {
  const errors: string[] = [];
  const popups: string[] = [];
  context.on('page', (p) => popups.push(p.url()));
  await context.route(/wunder\.it/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await openArtifact(page, errors);
  const at = await linkUnderForwardArrow(page);
  const z0 = await page.evaluate(() => window.__wunder!.player.z);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForFunction((z) => window.__wunder!.player.z < z - 0.1, z0, { timeout: 60_000 });
  await page.mouse.up();
  // Give a stray click time to open a tab, then check that none did.
  const f0 = await page.evaluate(() => window.__wunder!.frames);
  await page.waitForFunction((f) => window.__wunder!.frames > f + 3, f0, { timeout: 60_000 });
  await page.waitForTimeout(500);
  expect(popups).toEqual([]);
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test('tapping an arrow over a logo does not open the link; the view is wider than tall', async ({ page, context }) => {
    const errors: string[] = [];
    const popups: string[] = [];
    context.on('page', (p) => popups.push(p.url()));
    await context.route(/wunder\.it/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    await openArtifact(page, errors);
    // Portrait: the camera's vertical field of view opens up so the horizontal one stays usable.
    const hfov = await page.evaluate(() => {
      const cam = window.__wunder!.scene.children.find((o) => (o as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) as import('three').PerspectiveCamera;
      return (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect) * 180) / Math.PI;
    });
    expect(hfov).toBeGreaterThan(50);
    const at = await linkUnderForwardArrow(page);
    await page.touchscreen.tap(at.x, at.y);
    const f0 = await page.evaluate(() => window.__wunder!.frames);
    await page.waitForFunction((f) => window.__wunder!.frames > f + 3, f0, { timeout: 60_000 });
    await page.waitForTimeout(500);
    expect(popups).toEqual([]);
    expect(errors.filter((e) => !benign(e))).toEqual([]);
  });
});
