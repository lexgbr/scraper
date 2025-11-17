export type SiteId = 'romprod' | 'mastersale' | 'maxywholesale' | 'romegafoods' | 'foodex';

export type SiteDefinition = {
  id: SiteId;
  name: string;
  baseUrl: string;
  loginPath?: string;
  defaultSelector?: string | null;
  searchMode?: 'url' | 'query';
  searchUrl?: string;
};

export const SITE_DEFINITIONS: SiteDefinition[] = [
  {
    id: 'romprod',
    name: 'Romprod',
    baseUrl: 'https://romprod.uk',
    loginPath: '/my-account/',
    defaultSelector: 'span.woocommerce-Price-amount bdi',
  },
  {
    id: 'mastersale',
    name: 'Mastersale',
    baseUrl: 'https://mastersale.eu',
    loginPath: '/users/login',
    defaultSelector: 'price-netto',
  },
  {
    id: 'maxywholesale',
    name: 'Maxy Wholesale',
    baseUrl: 'https://maxywholesale.com',
    loginPath: '/order/',
    defaultSelector: 'select#productUnit',
    searchMode: 'query',
    searchUrl: 'https://maxywholesale.com/',
  },
  {
    id: 'romegafoods',
    name: 'Romega Foods',
    baseUrl: 'https://romegafoods.co.uk',
    loginPath: '/login?redirect_url=/my-account',
    defaultSelector: 'h1[class*="priceDetails_price"]',
  },
  {
    id: 'foodex',
    name: 'Foodex London',
    baseUrl: 'https://foodex.london',
    loginPath: '/login/',
    defaultSelector:
      'body > div.site > div.center.main-site > section > div > form > div > section > div > table > tbody > tr > td.price',
  },
];

export const SITE_ID_LIST = SITE_DEFINITIONS.map((s) => s.id);

export const SITE_BY_ID = new Map(SITE_DEFINITIONS.map((s) => [s.id, s] as const));

export const SITE_BY_NAME = new Map(
  SITE_DEFINITIONS.map((s) => [s.name.toLowerCase(), s] as const),
);

export function resolveSiteById(id: string | null | undefined): SiteDefinition | undefined {
  return id ? SITE_BY_ID.get(id as SiteId) : undefined;
}

export function resolveSiteByName(name: string | null | undefined): SiteDefinition | undefined {
  return name ? SITE_BY_NAME.get(name.toLowerCase()) : undefined;
}
