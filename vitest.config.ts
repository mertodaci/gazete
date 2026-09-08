import { fileURLToPath } from "node:url";
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
  resolve: {
    alias: {
      // apps/web's own tsconfig.json declares "@/*" -> "./src/*", which
      // TypeScript honors natively but Vite/Vitest does not read on its
      // own — so it needs the equivalent mapping here too.
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url))
    }
  },
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node",
    // Multiple test files share the same Postgres tables and isolate
    // themselves with table-wide deleteMany() calls in beforeEach. Running
    // files concurrently lets one file's cleanup race another file's
    // in-flight assertions, so keep file execution sequential.
    fileParallelism: false
  }
});
