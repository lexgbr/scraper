import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.queryRun.updateMany({ where:{ status:'running' },
  data:{ status:'error', note:'manual reset', finishedAt:new Date() } });
await prisma.$disconnect();
