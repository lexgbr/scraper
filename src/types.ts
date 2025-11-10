import type { SiteId } from './lib/sites.js';

export type Credentials = {
  username: string;
  password: string;
  totpSecret?: string;
};

export type ProductLink = {
  id?: number;
  name: string;
  sku?: string;
  siteId: SiteId;
  url: string;
  selector?: string | null;
  searchQuery?: string | null;
};

export type PriceResult = {
  amount: number;
  unitLabel?: string | null;
  packPrice?: number | null;
  packSize?: number | null;
  packLabel?: string | null;
};

export interface Adapter {
  siteId: SiteId;
  isLoggedIn(page: import('playwright').Page): Promise<boolean>;
  login(page: import('playwright').Page, cred: Credentials): Promise<void>;
  extractPrice(page: import('playwright').Page, link: ProductLink): Promise<PriceResult>;
}
