import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('romprod');
const BASE_URL = SITE?.baseUrl ?? 'https://romprod.uk';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/my-account/', BASE_URL).toString();
const DEFAULT_SELECTOR = SITE?.defaultSelector ?? '.elementor-widget-woocommerce-product-price span.woocommerce-Price-amount bdi, p.price span.woocommerce-Price-amount bdi, span.woocommerce-Price-amount bdi';

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

    try {
      await page.waitForURL('**/my-account/**', { timeout: 15000 });
    } catch {
      // Wait for network to settle instead
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
    }

    // Verify login by checking for logout link
    const loggedIn = (await page.locator('a[href*="customer-logout"]').count()) > 0;
    if (!loggedIn) {
      throw new Error('Romprod login failed - no logout link found');
    }
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    if (!link.url) {
      throw new Error('Missing Romprod product URL');
    }

    await page.goto(link.url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const selector = link.selector ?? DEFAULT_SELECTOR;
    const fallbackSelectors = [
      selector,
      '.price span[class*="amount"]',
      '.summary .price span[class*="amount"]',
      '.woocommerce-Price-amount',
      'span.price',
    ];
    let text: string | null = null;
    for (const candidate of fallbackSelectors) {
      const element = page.locator(candidate).first();
      try {
        await element.waitFor({ state: 'attached', timeout: 5000 });
        await element.scrollIntoViewIfNeeded().catch(() => undefined);
        text = await element.evaluate((el) => {
          const bdi = el.querySelector('bdi');
          if (bdi && bdi.textContent?.trim()) return bdi.textContent.trim();
          if (el.textContent?.trim()) return el.textContent.trim();
          return '';
        });
        if (text) break;
      } catch {
        // try next candidate
      }
    }
    if (!text) {
      await page.screenshot({ path: 'romprod-price-missing.png', fullPage: true }).catch(() => undefined);
      throw new Error('Unable to find price element on Romprod product page');
    }
    const amount = parsePriceToGBP(text).amount;
    return { amount, unitLabel: 'unit' };
  }
}
