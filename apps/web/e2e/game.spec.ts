import { expect, test, type Browser, type Page } from '@playwright/test';

const SHOTS = process.env.E2E_SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function newPlayer(browser: Browser, mobile = true) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 860 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  return ctx.newPage();
}

async function joinAs(browser: Browser, code: string, nickname: string) {
  const page = await newPlayer(browser);
  await page.goto(`/r/${code}`);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Vào làng' }).click();
  await expect(page.getByRole('heading', { name: 'Dân làng tụ họp' })).toBeVisible();
  return page;
}

async function roleOf(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Lật bài để xem vai' }).click();
  const name = await page.locator('h3').first().textContent();
  return (name ?? '').trim();
}

test('AUTO mode: four players play a full game through the UI', async ({ browser }) => {
  const host = await newPlayer(browser, false);
  await host.goto('/');
  await shot(host, '01-landing-desktop');
  await host.getByRole('link', { name: /Tạo phòng mới/ }).click();
  await host.getByLabel('Nickname của bạn').fill('Chủ');
  await host.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const code = host.url().split('/r/')[1] as string;

  const others: Page[] = [];
  for (const nick of ['An', 'Bình', 'Cường']) others.push(await joinAs(browser, code, nick));
  for (const p of others) await p.getByRole('button', { name: 'Sẵn sàng' }).click();
  await expect(host.getByText('4/4 sẵn sàng')).toBeVisible();
  await shot(host, '02-lobby-desktop');
  await shot(others[0] as Page, '03-lobby-mobile');

  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  const all = [host, ...others];
  const names = ['Chủ', 'An', 'Bình', 'Cường'];
  const roles: string[] = [];
  for (const p of all) {
    await expect(p.getByRole('button', { name: 'Lật bài để xem vai' })).toBeVisible();
  }
  await shot(others[0] as Page, '04-role-back-mobile');
  for (const p of all) roles.push(await roleOf(p));
  await shot(others[0] as Page, '05-role-front-mobile');
  for (const p of all) await p.getByRole('button', { name: 'Tôi đã ghi nhớ vai' }).click();

  const wolfIdx = roles.indexOf('Ma Sói');
  const seerIdx = roles.indexOf('Tiên Tri');
  expect(wolfIdx).toBeGreaterThanOrEqual(0);
  expect(seerIdx).toBeGreaterThanOrEqual(0);
  const villagerIdx = roles.findIndex((r) => r === 'Dân Làng');
  const wolf = all[wolfIdx] as Page;
  const seer = all[seerIdx] as Page;

  // Night — werewolves
  await expect(wolf.getByRole('heading', { name: 'Bầy Sói — chọn con mồi' })).toBeVisible();
  // In-game help explains what to do right now.
  await wolf.getByRole('button', { name: /Hướng dẫn: bây giờ tôi làm gì/ }).click();
  await expect(wolf.getByRole('dialog').getByText('Đến lượt bạn!')).toBeVisible();
  await shot(wolf, '06b-help-dialog-mobile');
  await wolf.keyboard.press('Escape');
  await shot(wolf, '06-night-wolf-mobile');
  await shot(all[villagerIdx] as Page, '07-night-sleeping-mobile');
  await wolf.getByRole('button', { name: new RegExp(`^${names[villagerIdx]}`) }).click();

  // Night — seer
  await expect(seer.getByRole('heading', { name: 'Tiên Tri — nhìn thấu một linh hồn' })).toBeVisible();
  await seer.getByRole('button', { name: new RegExp(`^${names[wolfIdx]}`) }).click();
  await seer.getByRole('button', { name: /^Soi / }).click();
  await expect(seer.getByRole('dialog').getByText('thuộc phe Sói')).toBeVisible();
  await shot(seer, '08-seer-result-mobile');
  await seer.getByRole('button', { name: 'Đã ghi nhớ' }).click();

  // Dawn → the villager died
  const victim = all[villagerIdx] as Page;
  await expect(victim.getByRole('heading', { name: 'Đêm qua có người đã ra đi' })).toBeVisible({ timeout: 30_000 });
  await shot(host, '09-dawn-desktop');

  // Discussion → everyone alive skips
  const alive = all.filter((_, i) => i !== villagerIdx);
  for (const p of alive) {
    await p.getByRole('button', { name: 'Sẵn sàng bỏ phiếu' }).click({ timeout: 30_000 });
  }

  // Voting → everyone votes the wolf (wolf votes the seer)
  for (const [i, p] of all.entries()) {
    if (i === villagerIdx) continue;
    const target = i === wolfIdx ? names[seerIdx] : names[wolfIdx];
    await p.getByRole('button', { name: new RegExp(`^${target}`) }).click();
    await p.getByRole('button', { name: /^Khóa phiếu/ }).click();
  }
  await expect(host.getByRole('heading', { name: 'Phe Dân Làng chiến thắng!' })).toBeVisible({ timeout: 30_000 });
  await shot(host, '10-game-over-desktop');
  await shot(others[0] as Page, '11-game-over-mobile');

  // Play again
  await host.getByRole('button', { name: 'Chơi lại cùng nhóm' }).click();
  await expect(host.getByRole('heading', { name: 'Dân làng tụ họp' })).toBeVisible();
});

test('guide page renders every section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/huong-dan');
  for (const h of ['Bắt đầu nhanh', 'Mục tiêu của mỗi phe', 'Một ván diễn ra thế nào', 'Cách chơi từng vai', 'Dành cho quản trò', 'Hỏi đáp']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  }
  await shot(page, '15-guide-mobile');
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.getByRole('link', { name: 'Cách chơi từng vai' }).click();
  await shot(page, '16-guide-roles-desktop');
});

test('HUMAN mode: moderator dashboard drives a night', async ({ browser }) => {
  const mod = await newPlayer(browser, false);
  await mod.goto('/create');
  await mod.getByRole('radio', { name: /Có quản trò/ }).click();
  await mod.getByLabel('Tên quản trò').fill('Quản Trò');
  await mod.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await mod.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const code = mod.url().split('/r/')[1] as string;
  const players: Page[] = [];
  for (const nick of ['Dũng', 'Giang', 'Hà', 'Khoa']) players.push(await joinAs(browser, code, nick));
  for (const p of players) await p.getByRole('button', { name: 'Sẵn sàng' }).click();
  await mod.getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(mod.getByText('Người chơi & vai')).toBeVisible();
  await shot(mod, '12-moderator-role-reveal');
  await mod.getByRole('button', { name: 'Giai đoạn tiếp' }).click();
  await expect(mod.getByText('Trạng thái hành động')).toBeVisible();
  await shot(mod, '13-moderator-night');
  // Skip through the night steps to dawn and confirm.
  for (let i = 0; i < 6; i++) {
    if (await mod.getByText('Xác nhận kết quả đêm').isVisible()) break;
    await mod.getByRole('button', { name: 'Giai đoạn tiếp' }).click();
    await mod.waitForTimeout(300);
  }
  await expect(mod.getByText('Xác nhận kết quả đêm')).toBeVisible();
  await expect(players[0]!.getByText('Đang chờ quản trò…')).toBeVisible();
  await shot(mod, '14-moderator-confirm');
  await mod.getByRole('button', { name: 'Công bố kết quả' }).click();
  await expect(players[0]!.getByRole('heading', { name: 'Một đêm bình yên' })).toBeVisible();
});

test('narration falls back to recorded VieNeu clips when the server has no TTS', async ({ browser }) => {
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await ctx.route('**/api/tts/status', (route) => route.fulfill({ json: { enabled: false, voice: null, engine: 'vieneu' } }));
    return ctx.newPage();
  };
  const host = await mk();
  const clips: string[] = [];
  host.on('request', (r) => {
    const m = r.url().match(/\/assets\/audio\/narration\/([^.?]+)\.mp3/);
    if (m?.[1]) clips.push(m[1]);
  });
  await host.goto('/create');
  await host.getByLabel('Nickname của bạn').fill('Người Dẫn');
  await host.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const code = host.url().split('/r/')[1] as string;
  const others: Page[] = [];
  for (const nick of ['Lan', 'Minh', 'Quân']) {
    const p = await mk();
    await p.goto(`/r/${code}`);
    await p.getByLabel('Nickname').fill(nick);
    await p.getByRole('button', { name: 'Vào làng' }).click();
    await p.getByRole('button', { name: 'Sẵn sàng' }).click();
    others.push(p);
  }
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  for (const p of [host, ...others]) {
    await p.getByRole('button', { name: 'Lật bài để xem vai' }).click();
    await p.getByRole('button', { name: 'Tôi đã ghi nhớ vai' }).click();
  }
  // Clips play back-to-back: "Đêm thứ nhất." then the werewolves' call.
  await expect.poll(() => clips.join(','), { timeout: 20_000 }).toContain('night-1,step-WEREWOLVES');
});
