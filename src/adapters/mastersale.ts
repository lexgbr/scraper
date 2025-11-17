import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('mastersale');
const BASE_URL = SITE?.baseUrl ?? 'https://mastersale.eu';
const LOGIN_URL = new URL(SITE?.loginPath ?? '/users/login', BASE_URL).toString();
const DASHBOARD_URL = new URL('/', BASE_URL).toString();

export class Mastersale extends BaseAdapter {
  siteId = 'mastersale' as const;

  async isLoggedIn(page: Page): Promise<boolean> {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    const hasLogout = await page
      .locator('a[href*="logout"], a:has-text("Logout"), a:has-text("Wyloguj")')
      .first()
      .count();
    const loginForms = await page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: /log(?:owanie|in)/i }) })
      .count();
    return hasLogout > 0 && loginForms === 0;
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    const attempt = async () => {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

      const changeButton = page.getByRole('button', { name: /change/i }).first();
      if (await changeButton.count()) {
        await changeButton.click().catch(() => undefined);
        await page.waitForTimeout(250);
        const englishLink = page.getByRole('link', { name: /^en$/i }).first();
        if (await englishLink.count()) {
          await englishLink.click().catch(() => undefined);
          await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        }
      }

      const form = page
        .locator('form')
        .filter({
          has: page.locator('button.btn.btn-primary.login-button, button[type="submit"], input[type="submit"]'),
        })
        .first();

      const user = form
        .locator(
          'input[type="email"], input[name*="email" i], input[name*="login" i], input[name*="user" i], input[type="text"]',
        )
        .first();
      const pass = form.locator('input[type="password"]').first();
      const submit = form
        .locator('button.btn.btn-primary.login-button, button[type="submit"], input[type="submit"]')
        .first();

      await user.waitFor({ state: 'visible', timeout: 15000 });
      await pass.waitFor({ state: 'visible', timeout: 15000 });

      await user.fill(cred.username);
      await pass.fill(cred.password);

      if (await submit.count()) {
        await Promise.all([page.waitForLoadState('domcontentloaded'), submit.click()]);
      } else {
        await pass.press('Enter');
        await page.waitForLoadState('domcontentloaded');
      }

      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(2000);
    };

    for (let i = 0; i < 3; i += 1) {
      await attempt();
      if (await this.isLoggedIn(page)) return;
    }

    await page.screenshot({ path: 'mastersale-login-fail.png', fullPage: true });
    throw new Error('Mastersale login failed');
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    const target = link.url?.trim();
    if (!target) throw new Error('Missing Mastersale product URL');

    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const defaultSelector =
      '#content > div.container.product-card-container > div > div.row.card-top-row > div.col-sm-12.col-lg-6.card-price > div.card-price-container > div.price-details-container > div:nth-child(1) > p.price-netto';
    const provided = (link.selector ?? '').trim();
    const targetSelector =
      !provided || /^\.?price-netto$/i.test(provided) || provided === 'price'
        ? defaultSelector
        : provided;

    const candidateSelectors = [
      targetSelector,
      'p.price-netto',
      '.price-netto',
      '.card-price .price-netto',
      '.price-details-container p.price-netto',
    ];

    let text: string | null = null;
    for (const selector of candidateSelectors) {
      const candidate = page.locator(selector).first();
      try {
        await candidate.waitFor({ state: 'visible', timeout: 8000 });
        text = (await candidate.innerText()).trim();
        if (text) break;
      } catch {
        // try next selector
      }
    }

    if (!text) {
      throw new Error(`Mastersale price selector not found for ${link.url}`);
    }

    const amount = parsePriceToGBP(text).amount;
    return { amount, unitLabel: 'unit' };
  }
}
