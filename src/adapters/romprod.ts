import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('romprod');
const BASE_URL = SITE?.baseUrl ?? 'https://romprod.uk';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/my-account/', BASE_URL).toString();
const DEFAULT_SELECTOR = SITE?.defaultSelector ?? 'span.woocommerce-Price-amount bdi';

export class Romprod extends BaseAdapter {
  siteId = 'romprod' as const;

  async isLoggedIn(page: Page): Promise<boolean> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    return (await page.locator('a[href*="customer-logout"]').count()) > 0;
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });

    const userInput = page
      .locator('input#username, input[name="username"], input[name="login"], input[type="email"]')
      .first();
    await userInput.waitFor({ state: 'visible', timeout: 15000 });
    await userInput.fill(cred.username);

    const passInput = page
      .locator('input#password[type="password"], input[name="password"][type="password"]')
      .first();
    await passInput.waitFor({ state: 'visible', timeout: 15000 });
    await passInput.fill(cred.password);

    await page
      .locator('button.woocommerce-form-login__submit, button[type="submit"], input[type="submit"]')
      .first()
      .click();

    await page.waitForURL('**/my-account/**', { timeout: 15000 });
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    const selector = link.selector ?? DEFAULT_SELECTOR;
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 15000 });
    const text = (await element.innerText()).trim();
    const amount = parsePriceToGBP(text).amount;
    return { amount, unitLabel: 'unit' };
  }
}
