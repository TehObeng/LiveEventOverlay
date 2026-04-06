import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { discoverRoutes, REQUIRED_PAGE_ROUTES } from './support/route-discovery';
import {
  DEFAULT_E2E_ADMIN_EMAIL,
  DEFAULT_E2E_ADMIN_PASSWORD,
  DEFAULT_E2E_EVENT_ID,
  MOCK_SESSION_COOKIE,
} from '@/lib/e2e-config';

const OUTPUT_ROOT = path.join(process.cwd(), 'output', 'playwright');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || DEFAULT_E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || DEFAULT_E2E_ADMIN_PASSWORD;
const EVENT_ID = process.env.NEXT_PUBLIC_E2E_EVENT_ID || DEFAULT_E2E_EVENT_ID;

type AuditRecord = {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  requestFailures: string[];
};

function createAuditRecord(): AuditRecord {
  return {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
  };
}

function attachAudits(page: import('@playwright/test').Page, audit: AuditRecord) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      audit.consoleErrors.push(message.text());
    }

    if (message.type() === 'warning') {
      audit.consoleWarnings.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    audit.pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const failureText = request.failure()?.errorText || 'failed';
    if (failureText === 'net::ERR_ABORTED') {
      return;
    }
    audit.requestFailures.push(`${request.method()} ${request.url()} => ${failureText}`);
  });
}

async function assertCleanAudits(audit: AuditRecord) {
  expect(
    audit.consoleErrors,
    `Console errors found: ${audit.consoleErrors.join('\n')}`,
  ).toEqual([]);
  expect(
    audit.consoleWarnings,
    `Console warnings found: ${audit.consoleWarnings.join('\n')}`,
  ).toEqual([]);
  expect(audit.pageErrors, `Page errors found: ${audit.pageErrors.join('\n')}`).toEqual([]);
  expect(
    audit.requestFailures,
    `Network failures found: ${audit.requestFailures.join('\n')}`,
  ).toEqual([]);
}

function withAppPath(route: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!basePath || basePath === '/') {
    return route;
  }

  if (route === '/') {
    return basePath;
  }

  return `${basePath}${route.startsWith('/') ? route : `/${route}`}`;
}

async function saveScreenshot(page: import('@playwright/test').Page, name: string) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(OUTPUT_ROOT, name),
    fullPage: true,
  });
}

async function runA11yAudit(page: import('@playwright/test').Page, disabledRules: string[] = []) {
  const axe = new AxeBuilder({ page });
  for (const rule of disabledRules) {
    axe.disableRules(rule);
  }
  const results = await axe.analyze();
  const serious = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact || ''),
  );
  expect(serious, `Accessibility violations: ${serious.map((item) => item.id).join(', ')}`).toEqual([]);
}

async function collectPerformance(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
      load: navigation?.loadEventEnd ?? 0,
      transferSize: navigation?.transferSize ?? 0,
    };
  });
}

async function expectFastEnough(page: import('@playwright/test').Page) {
  const metrics = await collectPerformance(page);
  expect(metrics.domContentLoaded).toBeLessThan(2500);
  expect(metrics.load).toBeLessThan(5000);
}

async function resetMockSession(page: import('@playwright/test').Page) {
  const response = await page.request.post(withAppPath('/api/admin/session'), {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      resetStore: true,
    },
  });
  expect(response.ok()).toBeTruthy();

  const setCookie = response.headers()['set-cookie'];
  expect(setCookie).toContain(MOCK_SESSION_COOKIE);

  const cookiePair = setCookie
    ?.split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${MOCK_SESSION_COOKIE}=`));
  const cookieValue = cookiePair?.split(';')[0]?.split('=')[1];
  expect(cookieValue).toBeTruthy();

  const cookieOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL || page.url() || 'http://127.0.0.1:3000',
  );

  await page.context().addCookies([
    {
      name: MOCK_SESSION_COOKIE,
      value: cookieValue || '',
      domain: cookieOrigin.hostname,
      path: '/',
      secure: cookieOrigin.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

test.describe.configure({ mode: 'serial' });

test('@polish route discovery includes every required page and admin/api surface', async () => {
  const routes = discoverRoutes();

  expect(routes.pages).toEqual(expect.arrayContaining(REQUIRED_PAGE_ROUTES));

  expect(routes.api).toContain('/api/admin/events');
  expect(routes.api).toContain('/api/admin/events/[id]');
  expect(routes.api).toContain('/api/admin/events/[id]/messages');
  expect(routes.api).toContain('/api/admin/events/[id]/messages/bulk');
  expect(routes.api).toContain('/api/admin/events/[id]/messages/test');
  expect(routes.api).toContain('/api/admin/messages/[id]');
  expect(routes.api).toContain('/api/admin/messages/[id]/approve');
  expect(routes.api).toContain('/api/admin/messages/[id]/reject');
  expect(routes.api).toContain('/api/public/events/[id]');
  expect(routes.api).toContain('/api/public/events/[id]/messages');
});

test('@polish public pages render cleanly across desktop and mobile', async ({ browser }) => {
  const audit = createAuditRecord();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  attachAudits(page, audit);

  await page.goto(withAppPath('/'), { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Create a moderated live chat wall for your event in minutes\./i })).toBeVisible();
  await expectFastEnough(page);
  await runA11yAudit(page, ['color-contrast']);
  await saveScreenshot(page, 'home-desktop.png');
  if (browser.browserType().name() === 'chromium' && process.platform === 'win32') {
    await expect(page).toHaveScreenshot('home-desktop-baseline.png');
  }

  await resetMockSession(page);

  await page.setViewportSize(devices['iPhone 13'].viewport);
  await page.goto(withAppPath(`/chat?eventId=${EVENT_ID}`), { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Live Event Overlay Demo/i })).toBeVisible();
  await page.getByLabel('Nama kamu').fill('Danel');
  await page.locator('#message-input').fill('Pesan mobile dari Playwright');
  await page.locator('#submit-button').click();
  await expect(page.locator('#submit-button')).toContainText(/Tunggu/i);
  await expect(page.locator('#message-input')).toHaveValue('');
  await saveScreenshot(page, 'chat-mobile.png');
  if (browser.browserType().name() === 'chromium' && process.platform === 'win32') {
    await expect(page).toHaveScreenshot('chat-mobile-baseline.png');
  }
  await assertCleanAudits(audit);
  await context.close();
});

test('@polish admin moderation and overlay playback work in a real controlled browser', async ({ browser }) => {
  test.slow();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const overlayContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const overlayPage = await overlayContext.newPage();
  const publicContext = await browser.newContext({ viewport: devices['iPhone 13'].viewport });
  const publicPage = await publicContext.newPage();

  const adminAudit = createAuditRecord();
  const overlayAudit = createAuditRecord();
  const publicAudit = createAuditRecord();
  attachAudits(page, adminAudit);
  attachAudits(overlayPage, overlayAudit);
  attachAudits(publicPage, publicAudit);

  await resetMockSession(page);

  await page.goto(withAppPath('/admin'), { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Admin Panel/i })).toBeVisible();
  await page.locator('#event-selector').selectOption(EVENT_ID);
  const autoApproveToggle = page.locator('#auto-approve-toggle');
  if (await autoApproveToggle.isChecked()) {
    await autoApproveToggle.uncheck();
    await page.locator('#save-config-btn').click();
    await expect(page.getByText(/Pengaturan tersimpan/i)).toBeVisible();
  }

  await publicPage.goto(withAppPath(`/chat?eventId=${EVENT_ID}`), { waitUntil: 'networkidle' });
  await publicPage.getByLabel('Nama kamu').fill('Playwright User');
  await publicPage.locator('#message-input').fill('Pesan pending untuk moderasi');
  await publicPage.locator('#submit-button').click();
  await expect(publicPage.locator('#submit-button')).toContainText(/Tunggu/i);
  await expect(publicPage.locator('#message-input')).toHaveValue('');

  await overlayPage.goto(withAppPath(`/overlay?eventId=${EVENT_ID}&obs=1`), { waitUntil: 'networkidle' });
  await expect(overlayPage.locator('.overlay-container')).toBeVisible();

  const pendingTab = page.getByRole('button', { name: /Menunggu/i });
  const approvedTab = page.getByRole('button', { name: /Disetujui/i });
  await pendingTab.click();
  await expect(pendingTab).toContainText('(2)');

  const pendingCard = page.locator('.message-card', {
    has: page.getByRole('button', { name: /Setujui/i }),
  }).first();
  await expect(pendingCard).toBeVisible();
  const approvedMessageText = (await pendingCard.locator('.message-text').textContent())?.trim();
  expect(approvedMessageText).toBeTruthy();

  await pendingCard.getByRole('button', { name: /Setujui/i }).click();
  await expect(page.getByText(/Pesan disetujui/i)).toBeVisible();
  await expect(pendingTab).toContainText('(1)');
  await expect(approvedTab).toContainText('(2)');

  await approvedTab.click();
  await expect(
    page.locator('.message-card .message-text').filter({ hasText: approvedMessageText ?? '' }).first(),
  ).toBeVisible();
  await expect
    .poll(async () => (await overlayPage.locator('.overlay-container').innerHTML()).trim(), {
      timeout: 6000,
    })
    .toContain('Playwright User');

  await page.locator('#test-msg-btn').click();
  await expect(page.getByText(/Test message terkirim/i)).toBeVisible();
  await expect
    .poll(async () => (await overlayPage.locator('.overlay-container').innerHTML()).trim(), {
      timeout: 6000,
    })
    .toContain('Admin Test');

  await saveScreenshot(overlayPage, 'overlay-obs-live.png');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Bersihkan Layar/i }).click();
  await expect
    .poll(async () => (await overlayPage.locator('.overlay-container').innerHTML()).trim(), {
      timeout: 6000,
    })
    .toBe('');
  await saveScreenshot(overlayPage, 'overlay-obs-cleared.png');
  if (browser.browserType().name() === 'chromium' && process.platform === 'win32') {
    await expect(overlayPage).toHaveScreenshot('overlay-obs-cleared-baseline.png');
  }

  await expect
    .poll(async () => (await page.locator('.toast').textContent())?.trim() || '', {
      timeout: 6000,
    })
    .toContain('Layar overlay dibersihkan');

  await page.locator('#create-event-btn').click();
  await page.locator('#new-event-name').fill('Playwright Launch Room');
  await page.locator('#create-event-submit').click();
  await expect
    .poll(async () => (await page.locator('.toast').textContent())?.trim() || '', {
      timeout: 6000,
    })
    .toContain('Event dibuat');
  await page.locator('#event-selector').selectOption({ label: 'Live Event Overlay Demo' });

  await runA11yAudit(page, ['color-contrast']);
  await expectFastEnough(page);
  await assertCleanAudits(adminAudit);
  await assertCleanAudits(overlayAudit);
  await assertCleanAudits(publicAudit);

  await context.close();
  await overlayContext.close();
  await publicContext.close();
});

test('@polish security, API health, and deprecated routes respond safely', async ({ request, page }) => {
  const publicResponse = await request.get(withAppPath(`/api/public/events/${EVENT_ID}`));
  expect(publicResponse.ok()).toBeTruthy();

  const messagesResponse = await request.get(withAppPath(`/api/public/events/${EVENT_ID}/messages`));
  expect(messagesResponse.ok()).toBeTruthy();

  const adminResponse = await request.get(withAppPath('/api/admin/session'));
  expect(adminResponse.status()).toBe(401);

  const deprecatedEvents = await request.get(withAppPath('/api/events'));
  expect(deprecatedEvents.status()).toBe(410);

  const deprecatedMessages = await request.get(withAppPath('/api/messages'));
  expect(deprecatedMessages.status()).toBe(410);

  const homeResponse = await request.get(withAppPath('/'));
  const headers = homeResponse.headers();
  if (headers['content-security-policy']) {
    expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
  }
  if (headers['x-frame-options']) {
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  }

  await resetMockSession(page);
  const overlayAudit = createAuditRecord();
  attachAudits(page, overlayAudit);
  await page.goto(withAppPath(`/overlay?eventId=${EVENT_ID}&obs=1`), { waitUntil: 'networkidle' });
  await expect(page.locator('.overlay-container')).toBeVisible();

  const xssPayload = 'Security check <script>alert(1)</script> should stay escaped';
  const messageResponse = await request.post(withAppPath('/api/message'), {
    data: {
      eventId: EVENT_ID,
      text: xssPayload,
      senderName: 'Security Test',
    },
  });
  expect(messageResponse.ok()).toBeTruthy();

  await expect
    .poll(async () => await page.locator('.overlay-container').innerHTML(), {
      timeout: 6000,
    })
    .toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(await page.locator('.overlay-container').innerHTML()).not.toContain('<script>alert(1)</script>');
  await assertCleanAudits(overlayAudit);
});
