import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

// Shared "Son Dakika" business rules, used by both apps/worker (digest email +
// alert send) and apps/web (public homepage) so the two surfaces never drift
// on what counts as breaking or how many can show at once.
export const MAX_BREAKING_STORIES = 5;
export const BREAKING_WINDOW_MS = 12 * 60 * 60 * 1000;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
