import type { Frame, Page } from '@playwright/test';
import { ARTIFACT_URL, expect, openArtifact, routeArtifact, test } from './fixture';

const benign = (e: string) => /GPU stall|swiftshader|WebGL-|Automatic fallback|deprecated/i.test(e);

/** Let the page draw a few frames (SwiftShader is slow: wait on frames, not on the clock). */
async function frames(page: Page | Frame, n = 3): Promise<void> {
  const f0 = await page.evaluate(() => window.__wunder!.frames);
  await page.waitForFunction(([f, k]) => window.__wunder!.frames > f + k, [f0, n] as const, { timeout: 120_000 });
}

/** Stand in the lobby at (0, 6) with the big sign on its north wall in the middle of the screen. */
async function faceLobbySign(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window.__wunder!;
    const V = w.scene.position.constructor as typeof import('three').Vector3;
    const signs = w.links.links.filter((l) => l.url === 'https://www.wunder.it/').map((l) => ({ l, p: l.object.getWorldPosition(new V()) }));
    // The largest logo high on the lobby's north wall (z ≈ 0), seen from the lobby.
    const sign = signs.filter((s) => s.p.y > 3 && Math.abs(s.p.z) < 1).sort((a, b) => b.p.y - a.p.y)[0];
    const px = 0;
    const pz = 6;
    const dx = sign.p.x - px;
    const dz = sign.p.z - pz;
    w.player.teleport(px, pz, Math.atan2(-dx, -dz), Math.atan2(sign.p.y - 1.65, Math.hypot(dx, dz)));
  });
}

/** A point on the bare canvas (no logo link, no arrow button) in the given window. */
async function barePoint(page: Page | Frame, box = { x0: 400, x1: 1200, y0: 200, y1: 700 }): Promise<{ x: number; y: number }> {
  const p = await page.evaluate((b) => {
    for (let y = b.y0; y < b.y1; y += 20)
      for (let x = b.x0; x < b.x1; x += 20) if (document.elementFromPoint(x, y)?.id === 'gl' && !window.__wunder!.hud.hit(x, y)) return { x, y };
    return null;
  }, box);
  expect(p).not.toBeNull();
  return p!;
}

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

  // The side arrows step sideways (the mouse turns the view): ← moves left, the heading stays.
  const side0 = await page.evaluate(() => ({ x: window.__wunder!.player.x, yaw: window.__wunder!.player.yaw }));
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((x0) => window.__wunder!.player.x < x0 - 0.3, side0.x, { timeout: 60_000 });
  await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(() => window.__wunder!.player.yaw)).toBeCloseTo(side0.yaw, 6);

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
 * Pretend the browser granted pointer lock to the canvas. Headless Chromium does lock for real
 * (see the next test), but CDP mouse moves carry no movementX/Y while locked: a stand-in lock
 * lets the test send its own mouse deltas. Like a real browser, the release lands later.
 */
async function fakePointerLock(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.getElementById('gl')!;
    let locked: Element | null = canvas;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
    document.exitPointerLock = () => {
      setTimeout(() => {
        locked = null;
        document.dispatchEvent(new Event('pointerlockchange'));
      }, 30);
    };
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  expect(await page.evaluate(() => window.__wunder!.input.locked)).toBe(true);
}

test('with the pointer locked the mouse turns the view, the wheel zooms, a click opens the logo in the crosshair', async ({ page, context }) => {
  const errors: string[] = [];
  const popups: string[] = [];
  context.on('page', (p) => popups.push(p.url()));
  await context.route(/wunder\.it/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await openArtifact(page, errors);
  await page.evaluate(() => window.__wunder!.teleport('lobby'));
  await fakePointerLock(page);

  // Mouse movement turns the view: right and down. The first move after the lock lands, which
  // can carry the cursor's jump to the centre, and a warp spike are dropped, not applied.
  await page.waitForTimeout(200);
  const v0 = await page.evaluate(() => ({ yaw: window.__wunder!.player.yaw, pitch: window.__wunder!.player.pitch }));
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: -900, movementY: -560 }));
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 50 }));
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 2000, movementY: 0 }));
  });
  await page.waitForFunction((y) => window.__wunder!.player.yaw < y - 0.1, v0.yaw, { timeout: 60_000 });
  const v1 = await page.evaluate(() => ({ yaw: window.__wunder!.player.yaw, pitch: window.__wunder!.player.pitch }));
  expect(v1.pitch).toBeLessThan(v0.pitch - 0.05);
  // Only the 100 px move: 100 × 0.0022 rad.
  expect(v0.yaw - v1.yaw).toBeCloseTo(0.22, 3);

  // The wheel zooms in (narrower field of view; one event counts at most 3 notches = 1.18³),
  // and the middle button returns to 1x.
  const vw = page.viewportSize()!;
  await page.mouse.move(vw.width / 2, vw.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForFunction(() => window.__wunder!.player.zoom > 1.5, null, { timeout: 60_000 });
  const fov = await page.evaluate(() => {
    const cam = window.__wunder!.scene.children.find((o) => (o as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) as import('three').PerspectiveCamera;
    return cam.fov;
  });
  expect(fov).toBeLessThan(64 / 1.4);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.up({ button: 'middle' });
  await page.waitForFunction(() => window.__wunder!.player.zoom < 1.01, null, { timeout: 60_000 });

  // Aim the crosshair at the big sign on the lobby wall and click: its link opens.
  await faceLobbySign(page);
  await page.waitForFunction(() => window.__wunder!.links.aimed?.url === 'https://www.wunder.it/', null, { timeout: 60_000 });
  // No cursor while locked: the invisible links step aside.
  expect(await page.evaluate(() => document.getElementById('links')!.hidden)).toBe(true);
  await page.mouse.click(vw.width / 2, vw.height / 2);
  await expect.poll(() => popups.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(popups[0]).toContain('wunder.it');
  // Following the link hands the cursor back.
  await expect.poll(() => page.evaluate(() => window.__wunder!.input.locked), { timeout: 30_000 }).toBe(false);
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test('a click on the bare world really locks the pointer; a hidden logo link takes no click', async ({ page, context }) => {
  const errors: string[] = [];
  const popups: string[] = [];
  context.on('page', (p) => popups.push(p.url()));
  await context.route(/wunder\.it/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await openArtifact(page, errors);
  // Unlocked, the big lobby sign's link sits in the middle of the screen...
  await faceLobbySign(page);
  const handle = await page.waitForFunction(
    () => {
      for (const a of document.querySelectorAll<HTMLAnchorElement>('#links a:not([hidden])')) {
        const r = a.getBoundingClientRect();
        if (a.href === 'https://www.wunder.it/' && r.width > 100) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    },
    null,
    { timeout: 60_000 },
  );
  const at = (await handle.jsonValue())!;
  // ...then the visitor looks at the floor: the link must leave with the logo.
  await page.evaluate(() => {
    const p = window.__wunder!.player;
    p.teleport(p.x, p.z, p.yaw, -1.2);
  });
  await page.waitForFunction((p) => document.elementFromPoint(p.x, p.y)?.id === 'gl', at, { timeout: 60_000 });

  // A quick double-click there: the first click locks (headless Chromium really locks, after
  // refusing the raw-input option), the second neither counts as a refusal nor opens anything.
  const cdp = await context.newCDPSession(page);
  const click = async (count: number) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: count });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: count });
  };
  await page.mouse.move(at.x, at.y);
  // Before the click the watermark says how to take the camera with the mouse.
  await page.waitForFunction(() => window.__wunder!.hud.clickHintShown, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__wunder!.hud.escHintShown)).toBe(false);
  await click(1);
  await click(2);
  await page.waitForFunction(() => window.__wunder!.input.locked && document.pointerLockElement?.id === 'gl', null, { timeout: 30_000 });
  // The crosshair replaces the cursor: the links step aside, and the watermark switches to ESC.
  await page.waitForFunction(() => document.getElementById('links')!.hidden, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__wunder!.hud.escHintShown && !window.__wunder!.hud.clickHintShown, null, { timeout: 60_000 });
  await page.waitForTimeout(1500); // past the moment a lock request is judged
  expect(await page.evaluate(() => window.__wunder!.input.lockUnavailable)).toBe(false);
  expect(popups).toEqual([]);

  // Released: the links come back and nothing is aimed; one more click locks again.
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__wunder!.input.locked && !document.getElementById('links')!.hidden && window.__wunder!.links.aimed === null, null, {
    timeout: 60_000,
  });
  await page.waitForFunction(() => !window.__wunder!.hud.escHintShown && window.__wunder!.hud.clickHintShown, null, { timeout: 60_000 });
  await page.waitForTimeout(1600);
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => window.__wunder!.input.locked, null, { timeout: 30_000 });
  expect(popups).toEqual([]);
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test('in a frame without pointer-lock permission, the view still turns by dragging and the wheel zooms', async ({ page }) => {
  const errors: string[] = [];
  await routeArtifact(page, errors);
  // An artifact host that forgot allow-pointer-lock in the frame's sandbox.
  await page.route('https://host.test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0;height:3000px"><iframe sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="${ARTIFACT_URL}" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>`,
    }),
  );
  await page.goto('https://host.test/');
  await expect.poll(() => page.frames().some((f) => f.url() === ARTIFACT_URL), { timeout: 60_000 }).toBe(true);
  const frame = page.frames().find((f) => f.url() === ARTIFACT_URL)!;
  await frame.waitForFunction(() => window.__wunder?.ready === true, null, { timeout: 200_000 });
  await frame.evaluate(() => window.__wunder!.teleport('lobby'));
  await frames(frame);
  const at = await barePoint(frame);
  await page.mouse.move(at.x, at.y);
  await frames(frame, 1);
  expect(await frame.evaluate(() => (window.__wunder!.hud as unknown as { mouseIcon: { visible: boolean } }).mouseIcon.visible)).toBe(true);
  // Two refused clicks: the world stops asking and hides the "click to look" mouse.
  for (let i = 0; i < 2; i++) {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(1300);
  }
  await frame.waitForFunction(() => window.__wunder!.input.lockUnavailable, null, { timeout: 30_000 });
  expect(await frame.evaluate(() => window.__wunder!.input.locked)).toBe(false);
  await frame.waitForFunction(() => !(window.__wunder!.hud as unknown as { mouseIcon: { visible: boolean } }).mouseIcon.visible, null, { timeout: 60_000 });
  // ...and the "click to use the mouse as camera" watermark with it (a click would do nothing).
  await frame.waitForFunction(() => !window.__wunder!.hud.clickHintShown, null, { timeout: 60_000 });
  // Dragging turns the view.
  const yaw0 = await frame.evaluate(() => window.__wunder!.player.yaw);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(at.x + i * 12, at.y);
  await page.mouse.up();
  await frame.waitForFunction((y) => window.__wunder!.player.yaw < y - 0.1, yaw0, { timeout: 60_000 });
  // The wheel zooms the world, not the host page.
  await page.mouse.wheel(0, -300);
  await frame.waitForFunction(() => window.__wunder!.player.zoomTarget > 1.5, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors.filter((e) => !benign(e) && !/pointer lock/i.test(e))).toEqual([]);
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

  test('one finger turns, two fingers zoom, the arrows walk and step sideways, nothing asks for the pointer lock', async ({ page, context }) => {
    const errors: string[] = [];
    const popups: string[] = [];
    context.on('page', (p) => popups.push(p.url()));
    await context.route(/wunder\.it/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    await page.addInitScript(() => {
      const w = window as unknown as { __lockCalls: number };
      w.__lockCalls = 0;
      const orig = Element.prototype.requestPointerLock;
      Element.prototype.requestPointerLock = function (this: Element, ...args: Parameters<typeof orig>) {
        w.__lockCalls++;
        return orig.apply(this, args);
      };
    });
    await openArtifact(page, errors);
    const cdp = await context.newCDPSession(page);
    // CDP touches: touchStart/touchMove list every finger down; touchEnd lists the fingers lifted.
    const touch = (type: string, pts: Array<[number, number, number]>) =>
      cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: pts.map(([id, x, y]) => ({ id, x, y })) });
    const state = () =>
      page.evaluate(() => {
        const w = window.__wunder!;
        const hud = w.hud as unknown as { touchHint: { visible: boolean }; mouseIcon: { visible: boolean } };
        return {
          yaw: w.player.yaw,
          x: w.player.x,
          z: w.player.z,
          zt: w.player.zoomTarget,
          hint: hud.touchHint.visible,
          mouse: hud.mouseIcon.visible,
          watermark: w.hud.clickHintShown || w.hud.escHintShown,
        };
      });
    await page.evaluate(() => window.__wunder!.player.teleport(0, 11.5, 0, 0));
    await frames(page, 2);
    // A finger on a phone: the touch hint (a swiping fingertip), not the mouse icon.
    const s0 = await state();
    expect(s0.hint).toBe(true);
    expect(s0.mouse).toBe(false);
    expect(s0.watermark).toBe(false);
    const cx = 195;
    const cy = 320;

    // (1) One finger drags to the right: the view turns right.
    await touch('touchStart', [[1, cx, cy]]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[1, cx + i * 20, cy]]);
    await touch('touchEnd', [[1, cx + 100, cy]]);
    await page.waitForFunction((y) => window.__wunder!.player.yaw < y - 0.1, s0.yaw, { timeout: 60_000 });

    // (2) Two fingers spread apart: the lens zooms in, the view does not turn.
    const s1 = await state();
    await touch('touchStart', [[1, cx - 40, cy]]);
    await touch('touchStart', [[1, cx - 40, cy], [2, cx + 40, cy]]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[1, cx - 40 - i * 12, cy], [2, cx + 40 + i * 12, cy]]);
    await page.waitForFunction(() => window.__wunder!.player.zoom > 1.5, null, { timeout: 60_000 });
    const s2 = await state();
    expect(s2.yaw).toBeCloseTo(s1.yaw, 6);

    // (3) One finger lifts, the other moves on: neither a zoom nor a turn.
    await touch('touchEnd', [[2, cx + 100, cy]]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[1, cx - 100 + i * 20, cy]]);
    await frames(page, 2);
    const s3 = await state();
    expect(s3.zt).toBeCloseTo(s2.zt, 6);
    expect(s3.yaw).toBeCloseTo(s2.yaw, 6);
    await touch('touchEnd', [[1, cx, cy]]);

    // (4) A resting third finger: the first lifts, the second moves 1 px. The pinch now measures
    //     the remaining pair and does not jump.
    await page.evaluate(() => {
      const p = window.__wunder!.player;
      p.zoomTarget = p.zoom = 1;
    });
    await touch('touchStart', [[1, cx - 20, cy]]);
    await touch('touchStart', [[1, cx - 20, cy], [2, cx + 20, cy]]);
    await touch('touchStart', [[1, cx - 20, cy], [2, cx + 20, cy], [3, cx + 20, cy + 300]]);
    await touch('touchEnd', [[1, cx - 20, cy]]);
    await touch('touchMove', [[2, cx + 21, cy], [3, cx + 20, cy + 300]]);
    await frames(page, 2);
    expect((await state()).zt).toBeLessThan(1.05);
    await touch('touchEnd', [[2, cx + 21, cy], [3, cx + 20, cy + 300]]);

    // The visitor has turned and zoomed: the touch hint is gone.
    await page.waitForFunction(() => !(window.__wunder!.hud as unknown as { touchHint: { visible: boolean } }).touchHint.visible, null, { timeout: 60_000 });

    // (5) Holding ← on the pad steps left; the heading stays.
    await page.evaluate(() => window.__wunder!.player.teleport(0, 11.5, 0, 0));
    await frames(page, 1);
    const left = await page.evaluate(() => window.__wunder!.hud.center('strafeLeft'));
    await touch('touchStart', [[1, left.x, left.y]]);
    await page.waitForFunction(() => window.__wunder!.player.x < -0.3, null, { timeout: 60_000 });
    await touch('touchEnd', [[1, left.x, left.y]]);
    expect((await state()).yaw).toBe(0);

    // (6) Taps on the bare world and on an arrow never ask for the pointer lock.
    const bare = await barePoint(page, { x0: 40, x1: 360, y0: 120, y1: 500 });
    await page.touchscreen.tap(bare.x, bare.y);
    const fwd = await page.evaluate(() => window.__wunder!.hud.center('forward'));
    await page.touchscreen.tap(fwd.x, fwd.y);
    await frames(page, 2);
    expect(await page.evaluate(() => (window as unknown as { __lockCalls: number }).__lockCalls)).toBe(0);
    expect(await page.evaluate(() => window.__wunder!.input.locked)).toBe(false);
    expect(popups).toEqual([]);
    expect(errors.filter((e) => !benign(e))).toEqual([]);
  });
});
