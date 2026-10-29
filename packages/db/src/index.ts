// Node-only Postgres access (Prisma). Schema: prisma/schema.prisma.
export * from './client.js';
export * from './catalog.js';
export * from './catalog-read.js';
export * from './course-mapping.js';
export { Prisma, PrismaClient, type CatalogYear, type RecordOrigin } from './generated/client.js';
