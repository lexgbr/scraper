import type { Page } from 'playwright';
import type { Credentials, ProductLink, PriceResult } from '../types.js';
import { BaseAdapter } from './base.js';
import { parsePriceToGBP } from '../lib/price.js';
import { resolveSiteById } from '../lib/sites.js';

const SITE = resolveSiteById('maxywholesale');
const BASE_URL = SITE?.baseUrl ?? 'https://maxywholesale.com';
const ACCOUNT_URL = new URL(SITE?.loginPath ?? '/order/', BASE_URL).toString();
const DEFAULT_PANEL_URL = new URL('/order/panel.php?CategoryID=75', BASE_URL).toString();
const PANEL_MATCHER = /\/order\/panel\.php/i;
const USER_INPUT = 'input#eMail[name="eMail"], input[type="email"], input[name="username"]';
const PASS_INPUT = 'input#PassCode[type="password"], input[name="password"], input[type="password"]';
const SUBMIT_BUTTON =
  'button.btn.btn-success, button[name="login"], button.woocommerce-form-login__submit, button[type="submit"], input[type="submit"], button:has-text("Sign In")';
const NAVBAR_SEARCH_TOGGLE = 'nav.main-header [data-widget="navbar-search"]';
const SEARCH_BLOCK = 'nav.main-header .navbar-search-block';
const SEARCH_INPUT = `${SEARCH_BLOCK} input.form-control.form-control-navbar`;
const SEARCH_SUBMIT = `${SEARCH_BLOCK} button[type="submit"]`;
const PRODUCT_CARD = '.productArea.simpleCart_shelfItem';
const PACK_INFO_LOCATOR = '[class*="product_boxInfo"], .qtySizeText';
const PRICE_LOCATOR = 'h1[class*="price"], .priceDetails_price__';

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitForPriceText(locator: ReturnType<Page['locator']>): Promise<string> {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  return (await locator.innerText()).trim();
}

export class MaxyWholesale extends BaseAdapter {
  siteId = 'maxywholesale' as const;
  private panelUrl: string = DEFAULT_PANEL_URL;

  async isLoggedIn(page: Page): Promise<boolean> {
    if (PANEL_MATCHER.test(page.url()) && (await this.hasSearchControls(page))) {
      this.rememberPanel(page.url());
      return true;
    }

    try {
      await page.goto(this.panelUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
    } catch {
      return false;
    }

    if (PANEL_MATCHER.test(page.url()) && (await this.hasSearchControls(page))) {
      this.rememberPanel(page.url());
      return true;
    }

    const logoutLink = await page
      .locator('a[href*="log-out"], a[href*="logout"], a:has-text("Log out"), a:has-text("Logout")')
      .first()
      .count();
    return logoutLink > 0;
  }

  private rememberPanel(url: string | undefined) {
    if (url && PANEL_MATCHER.test(url)) {
      this.panelUrl = url;
    }
  }

  private async hasSearchControls(page: Page): Promise<boolean> {
    const toggle = page.locator(NAVBAR_SEARCH_TOGGLE).first();
    return (await toggle.count()) > 0;
  }

  private async ensurePanel(page: Page) {
    for (let i = 0; i < 3; i += 1) {
      if (await this.hasSearchControls(page)) {
        this.rememberPanel(page.url());
        return;
      }

      await page.goto(this.panelUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(600);
    }

    await page.screenshot({ path: 'maxywholesale-panel-missing.png', fullPage: true }).catch(() => undefined);
    throw new Error('Unable to reach MaxyWholesale order panel');
  }

  async login(page: Page, cred: Credentials): Promise<void> {
    await page.goto(ACCOUNT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'maxywholesale-login-start.png', fullPage: true }).catch(() => undefined);

    const categoryInput = page.locator('#CategoryID');
    if (await categoryInput.count()) {
      const categoryValue = (await categoryInput.inputValue()).trim();
      if (categoryValue) {
        this.panelUrl = new URL(`/order/panel.php?CategoryID=${categoryValue}`, BASE_URL).toString();
      }
    }

    const user = page
      .locator('input[type="email"], input[name="eMail"], input#eMail, input[placeholder*="mail" i]')
      .first();
    const pass = page
      .locator('input[type="password"], input[name="PassCode"], input#PassCode, input[placeholder*="password" i]')
      .first();

    const userCount = await user.count();
    const passCount = await pass.count();

    if (userCount === 0 || passCount === 0) {
      await page.screenshot({ path: 'maxywholesale-inputs-not-found.png', fullPage: true });
      throw new Error(`Login inputs not found - email: ${userCount}, password: ${passCount}`);
    }

    await user.waitFor({ state: 'visible', timeout: 15000 });
    await pass.waitFor({ state: 'visible', timeout: 15000 });

    await user.click();
    await page.waitForTimeout(100);
    await user.fill(cred.username);
    await page.waitForTimeout(300);

    await pass.click();
    await page.waitForTimeout(100);
    await pass.fill(cred.password);
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'maxywholesale-login-filled.png', fullPage: true }).catch(() => undefined);

    const submitButton = page.getByRole('button', { name: /sign in/i }).first();
    const fallbackSubmit = page.locator('button[type="submit"], input[type="submit"]').first();
    const clickTarget = (await submitButton.count()) ? submitButton : fallbackSubmit;

    if ((await clickTarget.count()) === 0) {
      await page.screenshot({ path: 'maxywholesale-no-submit.png', fullPage: true });
      throw new Error('Submit button not found');
    }

    await clickTarget.click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'maxywholesale-after-submit.png', fullPage: true }).catch(() => undefined);

    if (!(await this.isLoggedIn(page))) {
      await page.screenshot({ path: 'maxywholesale-login-fail.png', fullPage: true });
      throw new Error('MaxyWholesale login failed');
    }
  }

  async extractPrice(page: Page, link: ProductLink): Promise<PriceResult> {
    const query = link.searchQuery?.trim() || link.sku?.trim() || link.name?.trim();
    if (!query) throw new Error('Missing search query for maxywholesale product');

    await this.ensurePanel(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(400);

    const toggle = page.locator(NAVBAR_SEARCH_TOGGLE).first();
    const searchBlock = page.locator(SEARCH_BLOCK).first();
    if (!(await searchBlock.isVisible())) {
      await toggle.click();
      await searchBlock.waitFor({ state: 'visible', timeout: 10000 });
    }

    const search = page.locator(SEARCH_INPUT).first();
    await search.waitFor({ state: 'visible', timeout: 15000 });
    await search.fill('');
    await search.type(query, { delay: 25 });

    const searchBtn = page.locator(SEARCH_SUBMIT).first();
    if (await searchBtn.count()) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        searchBtn.click(),
      ]);
    } else {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        search.press('Enter'),
      ]);
    }

    await page.waitForLoadState('networkidle');

    const safeName = escapeRegExp(query);
    const productCard = page
      .locator(PRODUCT_CARD)
      .filter({
        hasText: new RegExp(safeName, 'i'),
      })
      .first();

    try {
      await productCard.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      throw new Error(`Product "${query}" not found on Maxy Wholesale`);
    }

    const detailLink = await productCard.locator('a[href]').first().getAttribute('href');
    if (detailLink) {
      const target = new URL(detailLink, BASE_URL).toString();
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }

    const priceElement = page.locator(PRICE_LOCATOR).first();
    let packPrice = parsePriceToGBP(await waitForPriceText(priceElement)).amount;
    let unitPrice: number | null = null;
    let packSize: number | null = null;

    const packInfo = page.locator(PACK_INFO_LOCATOR).first();
    if (await packInfo.count()) {
      const text = (await packInfo.innerText()).replace(/\s+/g, ' ').trim();
      const match = text.match(/(\d+)\s*[xX]/);
      if (match) packSize = Number(match[1]);
    }

    const unitSelect = page.locator('select#productUnit, select[name="productUnit"]').first();
    if (await unitSelect.count()) {
      const options = await unitSelect.locator('option').all();
      for (const option of options) {
        const optionValue = (await option.getAttribute('value')) ?? undefined;
        const label = ((await option.textContent()) ?? '').trim();
        const disabled = await option.evaluate((el) => el.hasAttribute('disabled'));
        if (disabled) continue;

        if (/box/i.test(label) || /box/i.test(optionValue ?? '')) {
          if (optionValue) await unitSelect.selectOption(optionValue);
          else await unitSelect.selectOption({ label });
          await page.waitForTimeout(250);
          packPrice = parsePriceToGBP(await waitForPriceText(priceElement)).amount;
          if (!packSize) {
            const sizeMatch = label.match(/(\d+)/);
            if (sizeMatch) packSize = Number(sizeMatch[1]);
          }
        } else if (/unit/i.test(label) || /unit/i.test(optionValue ?? '')) {
          if (optionValue) await unitSelect.selectOption(optionValue);
          else await unitSelect.selectOption({ label });
          await page.waitForTimeout(250);
          unitPrice = parsePriceToGBP(await waitForPriceText(priceElement)).amount;
        }
      }

      const boxOption = await unitSelect.locator('option').filter({ hasText: /box/i }).first();
      if (await boxOption.count()) {
        const val = await boxOption.getAttribute('value');
        if (val) await unitSelect.selectOption(val);
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
