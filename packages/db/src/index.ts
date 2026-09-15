import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

// Shared "Son Dakika" business rules, used by both apps/worker (digest email +
// alert send) and apps/web (public homepage) so the two surfaces never drift
// on what counts as breaking or how many can show at once.
export const MAX_BREAKING_STORIES = 5;
export const BREAKING_WINDOW_MS = 12 * 60 * 60 * 1000;

// Free-text personalized interest ("Senin İçin") business rules — shared by
// apps/web (subscribe/preferences forms + API routes) and apps/worker
// (digest matching) so both surfaces agree on the same limits.
export const MAX_INTEREST_TEXT_LENGTH = 250;
export const MAX_INTEREST_STORIES = 6;
// Cosine similarity is in [-1, 1]; 1 is identical, 0 is unrelated. This
// threshold is a starting point, not a calibrated value — expect to tune it
// after seeing real subscriber text against real story embeddings.
export const INTEREST_SIMILARITY_THRESHOLD = 0.7;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
