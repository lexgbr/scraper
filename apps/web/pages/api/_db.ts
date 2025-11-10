import { PrismaClient } from '@prisma/client';
import { SITE_DEFINITIONS } from '../../../../config/sites';

const shouldSeedDemo = process.env.SEED_DEMO !== 'false';

let prisma: PrismaClient | null = null;
export function db() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export async function ensureSeed() {
  const client = db();

  for (const site of SITE_DEFINITIONS) {
    await client.site.upsert({
      where: { name: site.name },
      update: { base: site.baseUrl },
      create: { name: site.name, base: site.baseUrl },
    });
  }

  if (!shouldSeedDemo) return;

  const hasProducts = await client.product.count();
  if (hasProducts > 0) return;

  const romprod = await client.site.findFirst({
    where: { name: 'Romprod' },
  });

  if (romprod) {
    await client.product.create({
      data: {
        name: 'Bake Rolls Garlic 80g',
        sku: 'SKU-TEST',
        links: {
          create: {
            siteId: romprod.id,
            url: 'https://romprod.uk/product/7-days-bake-rolls-usturoi-80g-12/',
            selector: 'span.woocommerce-Price-amount bdi',
          },
        },
      },
    });
  }
}

