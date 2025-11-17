import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('romegafoods');
const BASE_URL = SITE?.baseUrl ?? 'https://romegafoods.co.uk';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/login', BASE_URL).toString();
const DEFAULT_SELECTOR = SITE?.defaultSelector ?? 'h1[class*="price"]';
const PACK_INFO_LOCATOR = '[class*="product_boxInfo"]';
const UNIT_SELECT = 'select#productUnit, select[name="productUnit"]';
const DASHBOARD_URL = new URL('/my-account', BASE_URL).toString();
const USER_INPUT =
  'form[action*="/login"] input[name="email"], input.login_loginUserClass__LT7ZR input, input.login_loginUserClass__LT7ZR, input#username, input[name="username"], input[type="email"]';
const PASS_INPUT =
  'form[action*="/login"] input[name="password"], input.login_loginPasswordClass__Phz0Z input, input.login_loginPasswordClass__Phz0Z, input#password, input[type="password"]';
const SUBMIT_BUTTON =
  'form[action*="/login"] button:has-text("Login"), form[action*="/login"] button[type="submit"], button.login_loginButtonClass__2P6Jc, button.login_loginButton__DqZfp';

export class RomegaFoods extends BaseAdapter {
  siteId = 'romegafoods' as const;

  private async hasLogoutLink(page: Page): Promise<boolean> {
    const logoutLink = await page.locator('a[href*="logout"], a:has-text("Log out"), a:has-text("Logout")').first();
    return (await logoutLink.count()) > 0;
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    if (await this.hasLogoutLink(page)) return true;
    const current = page.url();
    if (!/\/login/i.test(current)) {
      return false;
    }

    try {
      await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
    } catch {
      return false;
    }

    if (await this.hasLogoutLink(page)) return true;
    return !/\/login/i.test(page.url());
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });

    const email = page.locator(USER_INPUT).first();
    await email.waitFor({ state: 'visible', timeout: 15000 });
    await email.fill('');
    await email.type(cred.username, { delay: 30 });

    const pass = page.locator(PASS_INPUT).first();
    await pass.waitFor({ state: 'visible', timeout: 15000 });
    await pass.fill('');
    await pass.type(cred.password, { delay: 30 });

    if (cred.totpSecret) {
      const totp = this.totp(cred.totpSecret);
      const totpInput = page
        .locator('input[name*="otp" i], input[name*="code" i], input[name*="totp" i]')
        .first();
      if (await totpInput.count()) {
        await totpInput.fill(totp ?? '');
      }
    }

    const button = page.locator(SUBMIT_BUTTON).first();
    await button.waitFor({ state: 'visible', timeout: 15000 });
    const clickable = button.filter({ hasText: /login/i });
    if (await clickable.count()) {
      await clickable.click({ force: true });
    } else {
      await button.click({ force: true });
    }

    try {
      await page.waitForURL(
        (url) => !/\/login/i.test(url.href) || /\/my-account/i.test(url.href) || /\/$/i.test(url.pathname),
        { timeout: 20000 },
      );
    } catch {
      // stay on page; we'll handle below
    }

    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(500);

    // pop-up dismissal (Cancel button) - if popup appears, login was successful
    let popupAppeared = false;
    try {
      const modalButton = page.getByRole('button', { name: /cancel/i }).first();
      if (await modalButton.count()) {
        popupAppeared = true;
        await modalButton.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }
    } catch {
      // ignore if modal does not appear
    }

    // If popup appeared, login was successful, no need to check logout link
    if (popupAppeared) {
      return;
    }

    // Otherwise, verify login by checking for logout link
    if (!(await this.hasLogoutLink(page))) {
      await page.waitForTimeout(1000);
      if (!(await this.hasLogoutLink(page))) {
        await page.screenshot({ path: 'romegafoods-login-fail.png', fullPage: true });
        throw new Error('RomegaFoods login failed');
      }
    }
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    if (!link.url) {
      throw new Error('RomegaFoods product link missing URL');
    }

    await page.goto(link.url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    if (/404/.test(await page.title())) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await page.waitForTimeout(1000);
    }

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
      // restore box view
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
