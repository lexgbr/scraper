import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';
import { waitForCloudflare } from '../lib/cloudflare.js';

const SITE = resolveSiteById('foodex');
const BASE_URL = SITE?.baseUrl ?? 'https://foodex.london';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/my-account/', BASE_URL).toString();
const DEFAULT_SELECTOR = SITE?.defaultSelector ?? 'h1[class*="price"]';
const PACK_INFO_LOCATOR = '[class*="product_boxInfo"]';
const UNIT_SELECT = 'select#productUnit, select[name="productUnit"]';

export class FoodexLondon extends BaseAdapter {
  siteId = 'foodex' as const;

  async isLoggedIn(page: Page): Promise<boolean> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    await waitForCloudflare(page);
    const logoutLink = await page.locator('a[href*="logout"], a:has-text("Log out"), a:has-text("Logout")').first();
    return (await logoutLink.count()) > 0;
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    await waitForCloudflare(page);

    const user = page
      .locator('input#username, input[name="username"], input[type="email"], input[name*="login" i]')
      .first();
    const pass = page.locator('input#password[type="password"], input[name="password"][type="password"]').first();
    const submit = page
      .locator('button[name="login"], button.woocommerce-form-login__submit, button[type="submit"], input[type="submit"]')
      .first();

    await user.waitFor({ state: 'visible', timeout: 15000 });
    await pass.waitFor({ state: 'visible', timeout: 15000 });

    await user.fill(cred.username);
    await pass.fill(cred.password);

    if (await submit.count()) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), submit.click()]);
    } else {
      await pass.press('Enter');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    }

    if (!(await this.isLoggedIn(page))) {
      await page.screenshot({ path: 'foodex-login-fail.png', fullPage: true });
      throw new Error('Foodex login failed');
    }
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    const targetSelector = link.selector ?? DEFAULT_SELECTOR;
    const locator = page.locator(targetSelector).first();
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    let packPrice = parsePriceToGBP((await locator.innerText()).trim()).amount;

    let packSize: number | null = null;
    const packInfo = page.locator(PACK_INFO_LOCATOR).first();
    if (await packInfo.count()) {
      const text = (await packInfo.innerText()).replace(/\s+/g, ' ').trim();
      const match = text.match(/(\d+)\s*[xX]/);
      if (match) packSize = Number(match[1]);
    }

    let unitPrice: number | null = null;
    const select = page.locator(UNIT_SELECT).first();
    if (await select.count()) {
      const options = await select.locator('option').all();
      for (const option of options) {
        const value = await option.getAttribute('value');
        const label = ((await option.textContent()) ?? '').trim();
        const disabled = await option.evaluate((el) => el.hasAttribute('disabled'));
        if (disabled) continue;

        if (/unit/i.test(label) || /unit/i.test(value ?? '')) {
          if (value) await select.selectOption(value);
          else await select.selectOption({ label });
          await page.waitForTimeout(200);
          unitPrice = parsePriceToGBP((await locator.innerText()).trim()).amount;
        } else if (/box/i.test(label) || /box/i.test(value ?? '')) {
          if (value) await select.selectOption(value);
          else await select.selectOption({ label });
          await page.waitForTimeout(200);
          packPrice = parsePriceToGBP((await locator.innerText()).trim()).amount;
          if (!packSize) {
            const sizeMatch = label.match(/(\d+)/);
            if (sizeMatch) packSize = Number(sizeMatch[1]);
          }
        }
      }
      const boxOption = await select.locator('option').filter({ hasText: /box/i }).first();
      if (await boxOption.count()) {
        const val = await boxOption.getAttribute('value');
        if (val) await select.selectOption(val);
      }
    }

    if (unitPrice == null && packPrice != null && packSize) {
      unitPrice = Number((packPrice / packSize).toFixed(4));
    }

    const amount = unitPrice ?? packPrice;
    return {
      amount,
      unitLabel: unitPrice != null ? 'unit' : null,
      packPrice: packPrice ?? null,
      packSize: packSize ?? null,
      packLabel: packPrice != null ? 'box' : null,
    };
  }
}
