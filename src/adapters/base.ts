import type { Adapter, Credentials, ProductLink, PriceResult } from '../types.js';
import type { SiteId } from '../lib/sites.js';
import { authenticator } from 'otplib';

export abstract class BaseAdapter implements Adapter {
  abstract siteId: SiteId;
  abstract isLoggedIn(page: import('playwright').Page): Promise<boolean>;
  abstract extractPrice(page: import('playwright').Page, link: ProductLink): Promise<PriceResult>;
  async login(_page: import('playwright').Page, _cred: Credentials): Promise<void> {
    throw new Error('Implement login in concrete adapter');
  }
  protected totp(secret?: string) {
    return secret ? authenticator.generate(secret) : undefined;
  }
}
