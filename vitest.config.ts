import { defineConfig } from "vitest/config";

// @prisma/client (and other libs) only read process.env — they don't load .env
// files themselves (that's a Prisma CLI-only feature). Load the repo-root .env
// here so every workspace's tests see DATABASE_URL etc. without each package
// needing its own dotenv setup.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // .env not present (e.g. CI providing real env vars) — ignore.
}

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node"
  }
});
