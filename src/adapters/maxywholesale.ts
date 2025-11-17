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
const LOGIN_FORM = 'form.signin-form';
const LOGIN_PAGE_MARKER = 'body.login-page';
const LOGIN_ERROR_MODAL = '#loginError.show, #loginError:not([aria-hidden="true"])';

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type OptionMeta = { kind: string; price?: number; packSize?: number };

function parseOptionValue(raw: string | undefined | null): OptionMeta | undefined {
  if (!raw) return undefined;
  const parts = raw.split('|').map((part) => part.trim());
  if (parts.length === 0) return undefined;

  let price: number | undefined;
  for (let i = 1; i < parts.length; i += 1) {
    const token = parts[i];
    if (!token) continue;
    const parsed = Number.parseFloat(token);
    if (!Number.isNaN(parsed)) {
      price = parsed;
      break;
    }
  }

  let packSize: number | undefined;
  const last = parts[parts.length - 1];
  if (last) {
    const parsedPack = Number.parseInt(last, 10);
    if (!Number.isNaN(parsedPack)) {
      packSize = parsedPack;
    }
  }

  return {
    kind: parts[0]?.toLowerCase() ?? '',
    price,
    packSize,
  };
}

async function waitForPriceText(locator: ReturnType<Page['locator']>): Promise<string> {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  return (await locator.innerText()).trim();
}

export class MaxyWholesale extends BaseAdapter {
  siteId = 'maxywholesale' as const;
  private panelUrl: string = DEFAULT_PANEL_URL;

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      if (!PANEL_MATCHER.test(page.url())) {
        await page.goto(this.panelUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => undefined);
      }
    } catch {
      return false;
    }

    if (await this.isOnPanel(page)) {
      this.rememberPanel(page.url());
      return true;
    }

    if (await this.isOnLoginPage(page)) {
      return false;
    }

    const logoutLink = await page
      .locator('a[href*="log-out"], a[href*="logout"], a:has-text("Log out"), a:has-text("Logout")')
      .first()
      .count();
    return logoutLink > 0;
  }

  private async isOnLoginPage(page: Page): Promise<boolean> {
    const loginForm = page.locator(LOGIN_FORM).first();
    const loginMarker = page.locator(LOGIN_PAGE_MARKER).first();
    return (await loginForm.count()) > 0 || (await loginMarker.count()) > 0;
  }

  private async isOnPanel(page: Page): Promise<boolean> {
    if (!PANEL_MATCHER.test(page.url())) return false;
    if (await this.hasSearchControls(page)) return true;
    const wrapper = page.locator('.content-wrapper, .main-sidebar').first();
    if ((await wrapper.count()) > 0 && !(await this.isOnLoginPage(page))) {
      return true;
    }
    return false;
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
      if (await this.isOnPanel(page)) {
        this.rememberPanel(page.url());
        return;
      }

      await page.goto(this.panelUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(600);

      if (await this.isOnLoginPage(page)) {
        await page.screenshot({ path: 'maxywholesale-login-required.png', fullPage: true }).catch(() => undefined);
        throw new Error('MaxyWholesale session expired while ensuring order panel');
      }
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

    const loginForm = page.locator(LOGIN_FORM).first();
    if ((await loginForm.count()) === 0) {
      await page.screenshot({ path: 'maxywholesale-login-form-missing.png', fullPage: true }).catch(() => undefined);
      throw new Error('MaxyWholesale login form not found');
    }

    const user = loginForm
      .locator('input[name="eMail"], input#eMail, input[type="email"], input[placeholder*="mail" i]')
      .first();
    const pass = loginForm
      .locator('input[name="PassCode"], input#PassCode, input[type="password"], input[placeholder*="password" i]')
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
    await page.waitForTimeout(500);

    const errorModal = page.locator(LOGIN_ERROR_MODAL).first();
    const loginStart = Date.now();

    while (Date.now() - loginStart < 20000) {
      if (await this.isOnPanel(page)) {
        this.rememberPanel(page.url());
        break;
      }

      if ((await errorModal.count()) > 0 && (await errorModal.isVisible())) {
        const message = (
          (await errorModal.locator('.modal-body').innerText().catch(() => 'Login failed')) ?? 'Login failed'
        ).trim();
        await page.screenshot({ path: 'maxywholesale-login-fail.png', fullPage: true }).catch(() => undefined);
        throw new Error(`MaxyWholesale login failed: ${message}`);
      }

      await page.waitForTimeout(500);
    }

    if (!(await this.isOnPanel(page))) {
      await page.screenshot({ path: 'maxywholesale-login-timeout.png', fullPage: true }).catch(() => undefined);
      throw new Error('MaxyWholesale login did not reach the order panel');
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

    try {
      const priceElement = productCard.locator(PRICE_LOCATOR).first();
      let fallbackPrice: number | null = null;
      if (await priceElement.count()) {
        try {
          fallbackPrice = parsePriceToGBP(await waitForPriceText(priceElement)).amount;
        } catch {
          fallbackPrice = null;
        }
      }

      const packInfo = productCard.locator(PACK_INFO_LOCATOR).first();
      let packSize: number | null = null;
      if (await packInfo.count()) {
        const text = (await packInfo.innerText()).replace(/\s+/g, ' ').trim();
        const match = text.match(/(\d+)\s*[xX]/);
        if (match) packSize = Number(match[1]);
      }

      const unitSelect = productCard.locator('select#productUnit, select[name="productUnit"]').first();
      if (!(await unitSelect.count())) {
        await page
          .screenshot({ path: 'maxywholesale-price-selector-missing.png', fullPage: true })
          .catch(() => undefined);
        throw new Error('MaxyWholesale price selector not found');
      }

      await unitSelect.waitFor({ state: 'visible', timeout: 15000 });
      const optionData = await unitSelect.locator('option').evaluateAll((nodes) =>
        nodes.map((node) => ({
          value: node.getAttribute('value') ?? '',
          label: (node.textContent ?? '').trim(),
          disabled: node.hasAttribute('disabled'),
          selected:
            node instanceof HTMLOptionElement
              ? node.selected
              : node.hasAttribute('selected') || node.getAttribute('selected') === 'true',
        })),
      );

      let packPrice: number | null = null;
      let unitPrice: number | null = null;

      for (const option of optionData) {
        const meta = parseOptionValue(option.value);
        const normalized = `${option.label} ${(meta?.kind ?? '')}`.toLowerCase();
        const isBox =
          /\bbox\b/.test(normalized) ||
          /\bcase\b/.test(normalized) ||
          /\bcarton\b/.test(normalized) ||
          /\bpack\b/.test(normalized) ||
          (meta?.kind ?? '').includes('box');
        const isUnit =
          /\bunit\b/.test(normalized) ||
          /\bpcs?\b/.test(normalized) ||
          /\bpiece\b/.test(normalized) ||
          /\beach\b/.test(normalized) ||
          /\bsingle\b/.test(normalized) ||
          /\bpc\b/.test(normalized) ||
          (meta?.kind ?? '').includes('pc');

        if (!isBox && !isUnit) continue;

        if (!packSize) {
          if (meta?.packSize && Number.isFinite(meta.packSize)) {
            packSize = Number(meta.packSize);
          } else {
            const sizeMatch = option.label.match(/(\d+)\s*[xX]/);
            if (sizeMatch) packSize = Number(sizeMatch[1]);
          }
        }

        if (isBox && meta?.price != null && (packPrice == null || option.selected)) {
          packPrice = meta.price;
        } else if (isUnit && meta?.price != null && (unitPrice == null || option.selected)) {
          unitPrice = meta.price;
        }
      }

      if (packPrice == null) {
        packPrice = fallbackPrice;
      }

      if (unitPrice == null && packPrice != null && packSize) {
        unitPrice = Number((packPrice / packSize).toFixed(4));
      }

      const amount = unitPrice ?? packPrice ?? fallbackPrice;
      if (amount == null) {
        await page
          .screenshot({ path: 'maxywholesale-price-missing.png', fullPage: true })
          .catch(() => undefined);
        throw new Error('Unable to derive price from MaxyWholesale price selector');
      }

      return {
        amount,
        unitLabel: unitPrice != null ? 'unit' : null,
        packPrice: packPrice ?? null,
        packSize: packSize ?? null,
        packLabel: packPrice != null ? 'box' : null,
      };
    } finally {
      // no-op
    }
  }
}
