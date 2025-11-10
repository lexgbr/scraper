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
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

    const form = page
      .locator('form')
      .filter({
        has: page.locator('button.btn.btn-primary.login-button, button[type="submit"], input[type="submit"]'),
      })
      .first();

    const user = form
      .locator('input[type="email"], input[name*="email" i], input[name*="login" i], input[name*="user" i], input[type="text"]')
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

    if (!(await this.isLoggedIn(page))) {
      await page.screenshot({ path: 'mastersale-login-fail.png', fullPage: true });
      throw new Error('Mastersale login failed');
    }
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    const targetSelector = link.selector ?? '.price, span.price, [data-test=price]';
    const locator = page.locator(targetSelector);
    await locator.first().waitFor({ state: 'visible', timeout: 15000 });
    const text = (await locator.first().innerText()).trim();
    const amount = parsePriceToGBP(text).amount;
    return { amount, unitLabel: 'unit' };
  }
}
