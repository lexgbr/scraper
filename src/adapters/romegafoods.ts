import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('romegafoods');
const BASE_URL = SITE?.baseUrl ?? 'https://romegafoods.co.uk';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/my-account/', BASE_URL).toString();
const DEFAULT_SELECTOR = SITE?.defaultSelector ?? 'h1[class*="price"]';
const PACK_INFO_LOCATOR = '[class*="product_boxInfo"]';
const UNIT_SELECT = 'select#productUnit, select[name="productUnit"]';
const USER_INPUT =
  'input[name="username"], input#username, input[type="email"], .login_loginUserClass__LT7ZR input, input.login_loginUserClass__LT7ZR';
const PASS_INPUT =
  'input[name="password"], input#password, input[type="password"], .login_loginPasswordClass__Phz0Z input, input.login_loginPasswordClass__Phz0Z';
const SUBMIT_BUTTON =
  'button[type="submit"], button.login_loginButtonClass__2P6Jc, button.login_loginButton__DqZfp, button:has-text("Login"), button:has-text("Sign in")';

export class RomegaFoods extends BaseAdapter {
  siteId = 'romegafoods' as const;

  async isLoggedIn(page: Page): Promise<boolean> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    const logoutLink = await page.locator('a[href*="logout"], a:has-text("Log out"), a:has-text("Logout")').first();
    return (await logoutLink.count()) > 0;
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });

    const emailField = page.getByRole('textbox', { name: /^email$/i }).first();
    const fallbackEmail = page.locator(USER_INPUT).first();
    const email = (await emailField.count()) ? emailField : fallbackEmail;
    await email.waitFor({ state: 'visible', timeout: 15000 });
    await email.fill(cred.username);

    const passwordField = page.getByRole('textbox', { name: /^password$/i }).first();
    const fallbackPass = page.locator(PASS_INPUT).first();
    const pass = (await passwordField.count()) ? passwordField : fallbackPass;
    await pass.waitFor({ state: 'visible', timeout: 15000 });
    await pass.fill(cred.password);

    if (cred.totpSecret) {
      const totp = this.totp(cred.totpSecret);
      const totpInput = page
        .locator('input[name*="otp" i], input[name*="code" i], input[name*="totp" i]')
        .first();
      if (await totpInput.count()) {
        await totpInput.fill(totp ?? '');
      }
    }

    const loginButton = page.getByRole('button', { name: 'Login', exact: true }).first();
    const fallbackSubmit = page.locator(SUBMIT_BUTTON).first();
    const button = (await loginButton.count()) ? loginButton : fallbackSubmit;

    if (await button.count()) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        button.click(),
      ]);
    } else {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        pass.press('Enter'),
      ]);
    }

    // pop-up dismissal (Cancel button)
    try {
      await page.getByRole('button', { name: 'Cancel', exact: true }).click({ timeout: 3000 });
    } catch {
      // ignore if modal does not appear
    }

    if (!(await this.isLoggedIn(page))) {
      await page.screenshot({ path: 'romegafoods-login-fail.png', fullPage: true });
      throw new Error('RomegaFoods login failed');
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
