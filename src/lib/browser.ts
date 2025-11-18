import { chromium, type BrowserContext } from 'playwright';
import { readStorageState } from './storage.js';

export async function newContext(siteId: string): Promise<BrowserContext> {
  const shouldUseStoredState = siteId !== 'maxywholesale';
  const state = shouldUseStoredState ? await readStorageState(siteId) : undefined;
  const options: any = {
    headless: true,
    slowMo: 150,
    viewport: { width: 1366, height: 768 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  };
  if (state) options.storageState = state;

  const ctx = await chromium.launchPersistentContext('', options);
  return ctx;
}
