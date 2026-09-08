# Gazete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Gazete personalized AI news newsletter: a Next.js subscribe/preferences/unsubscribe web app and a worker process that fetches RSS, dedupes/summarizes stories with Claude, and sends a personalized Turkish digest email every day at 08:45 Europe/Istanbul.

**Architecture:** npm-workspaces monorepo with `packages/db` (Prisma schema + client), `apps/web` (Next.js App Router — public pages + API routes), and `apps/worker` (long-running Node process with two `node-cron` jobs: hourly RSS fetch/dedupe/summarize, and the daily digest send). All three share one PostgreSQL database.

**Tech Stack:** Node.js 20, TypeScript, Next.js 14 (App Router), Prisma + PostgreSQL, Vitest, `rss-parser`, `@anthropic-ai/sdk` (Claude Haiku), `resend` (email + bounce webhook), `node-cron`, Docker Compose + Caddy for deployment.

**Spec:** [docs/superpowers/specs/2026-09-08-gazete-design.md](../specs/2026-09-08-gazete-design.md)

## Global Constraints

- Timezone for all scheduling is `Europe/Istanbul` (fixed UTC+3, no DST).
- Categories are a fixed enum: `gundem, ekonomi, teknoloji, spor, dunya, saglik, kultur_sanat`.
- No user accounts/passwords — all per-subscriber actions (preferences, unsubscribe) use the subscriber's permanent `preferencesToken`.
- Subscribers are `active` immediately on signup (no click-to-verify). Invalid addresses are cleaned up via the email provider's bounce webhook, not by the user.
- During development, email sending targets only the developer's own verified address (no domain verified yet) — code reads sender/base URL from env vars so switching to a real domain later needs no code change.
- All new code ships with tests (Vitest) written before the implementation (TDD): write the failing test, watch it fail, implement, watch it pass, commit.

---

## Phase 0 — Monorepo & Local Infra

### Task 1: Initialize the npm-workspaces monorepo

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts` (root)
- Create: `.env.example`
- Modify: `.gitignore` (already exists — add `*.tsbuildinfo`)

**Interfaces:**
- Produces: root `package.json` with `"workspaces": ["apps/*", "packages/*"]`, shared devDependencies (`typescript`, `vitest`, `@types/node`), and scripts `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "gazete",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "@types/node": "^20.14.15"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: Create root `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 4: Create `.env.example`**

```bash
DATABASE_URL="postgresql://gazete:gazete@localhost:5432/gazete"
RESEND_API_KEY="re_xxx"
RESEND_WEBHOOK_SECRET="whsec_xxx"
FROM_EMAIL="Gazete <onboarding@resend.dev>"
ANTHROPIC_API_KEY="sk-ant-xxx"
BASE_URL="http://localhost:3000"
```

- [ ] **Step 5: Add `*.tsbuildinfo` to `.gitignore`**

Append a line `*.tsbuildinfo` to the existing `.gitignore`.

- [ ] **Step 6: Install root dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts .env.example .gitignore
git commit -m "chore: initialize npm workspaces monorepo"
```

---

### Task 2: Local PostgreSQL for development

**Files:**
- Create: `docker-compose.dev.yml`

**Interfaces:**
- Produces: a running Postgres reachable at the `DATABASE_URL` from `.env.example`, used by every later task's tests.

- [ ] **Step 1: Create `docker-compose.dev.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gazete
      POSTGRES_PASSWORD: gazete
      POSTGRES_DB: gazete
    ports:
      - "5432:5432"
    volumes:
      - gazete_pg_dev:/var/lib/postgresql/data

volumes:
  gazete_pg_dev:
```

- [ ] **Step 2: Start it and verify**

Run: `docker compose -f docker-compose.dev.yml up -d`
Then: `docker compose -f docker-compose.dev.yml ps`
Expected: `postgres` service listed as `running`/`healthy`.

- [ ] **Step 3: Copy `.env.example` to `.env`**

Run: `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
`.env` is already git-ignored — verify with `git check-ignore .env` (expected output: `.env`).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "chore: add local Postgres for development"
```

---

## Phase 1 — Data Model

### Task 3: Prisma schema and client

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`
- Test: `packages/db/src/index.test.ts`

**Interfaces:**
- Produces: `import { prisma } from "@gazete/db"` — a singleton `PrismaClient`, plus generated types `Category`, `SubscriberStatus`, `DigestStatus` re-exported from `@gazete/db`.

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@gazete/db",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0"
  },
  "devDependencies": {
    "prisma": "^5.18.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Category {
  gundem
  ekonomi
  teknoloji
  spor
  dunya
  saglik
  kultur_sanat
}

enum SubscriberStatus {
  active
  unsubscribed
}

enum DigestStatus {
  pending
  sent
  failed
}

model Source {
  id       String    @id @default(uuid())
  name     String
  rssUrl   String    @unique @map("rss_url")
  category Category
  active   Boolean   @default(true)
  articles Article[]

  @@map("sources")
}

model Article {
  id             String         @id @default(uuid())
  sourceId       String         @map("source_id")
  source         Source         @relation(fields: [sourceId], references: [id])
  url            String         @unique
  title          String
  publishedAt    DateTime       @map("published_at")
  fetchedAt      DateTime       @default(now()) @map("fetched_at")
  rawDescription String?        @map("raw_description")
  storyArticles  StoryArticle[]

  @@map("articles")
}

model Story {
  id             String         @id @default(uuid())
  category       Category
  canonicalTitle String         @map("canonical_title")
  aiSummaryTr    String?        @map("ai_summary_tr")
  digestDate     DateTime       @map("digest_date") @db.Date
  createdAt      DateTime       @default(now()) @map("created_at")
  storyArticles  StoryArticle[]

  @@map("stories")
}

model StoryArticle {
  storyId   String  @map("story_id")
  story     Story   @relation(fields: [storyId], references: [id])
  articleId String  @map("article_id")
  article   Article @relation(fields: [articleId], references: [id])

  @@id([storyId, articleId])
  @@map("story_articles")
}

model Subscriber {
  id               String               @id @default(uuid())
  email            String               @unique
  status           SubscriberStatus     @default(active)
  preferencesToken String               @unique @map("preferences_token")
  createdAt        DateTime             @default(now()) @map("created_at")
  categories       SubscriberCategory[]
  digestSends      DigestSend[]

  @@map("subscribers")
}

model SubscriberCategory {
  subscriberId String     @map("subscriber_id")
  subscriber   Subscriber @relation(fields: [subscriberId], references: [id])
  category     Category

  @@id([subscriberId, category])
  @@map("subscriber_categories")
}

model DigestSend {
  id           String       @id @default(uuid())
  subscriberId String       @map("subscriber_id")
  subscriber   Subscriber   @relation(fields: [subscriberId], references: [id])
  digestDate   DateTime     @map("digest_date") @db.Date
  sentAt       DateTime?    @map("sent_at")
  status       DigestStatus @default(pending)

  @@unique([subscriberId, digestDate])
  @@map("digest_sends")
}
```

- [ ] **Step 3: Create `packages/db/src/index.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Install and run the initial migration**

Run: `npm install` (from repo root, to link the new workspace)
Run: `npm run prisma:migrate --workspace=@gazete/db -- --name init`
Expected: prompts create `packages/db/prisma/migrations/<timestamp>_init/migration.sql`, applies it to the dev Postgres, prints "Your database is now in sync with your schema."

- [ ] **Step 5: Write the failing test — `packages/db/src/index.test.ts`**

```typescript
import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "./index";

describe("prisma client", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects and can create + read a Source", async () => {
    const source = await prisma.source.create({
      data: {
        name: "Test Kaynak",
        rssUrl: "https://example.com/test-rss-" + Date.now(),
        category: "gundem"
      }
    });

    const found = await prisma.source.findUnique({ where: { id: source.id } });
    expect(found?.name).toBe("Test Kaynak");

    await prisma.source.delete({ where: { id: source.id } });
  });
});
```

- [ ] **Step 6: Run test to verify it fails first (before generate), then passes**

Run: `npm run prisma:generate --workspace=@gazete/db`
Run: `npx vitest run packages/db/src/index.test.ts`
Expected: PASS (Postgres is up from Task 2, migration applied in Step 4).

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): add Prisma schema and client"
```

---

## Phase 2 — Web: subscribe / preferences / unsubscribe

### Task 4: Scaffold `apps/web` and the token utility

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` (placeholder, replaced in Task 8)
- Create: `apps/web/src/lib/token.ts`
- Test: `apps/web/src/lib/token.test.ts`

**Interfaces:**
- Produces: `generateToken(): string`, used by Task 6 when creating a `Subscriber`.

- [ ] **Step 1: Scaffold Next.js app**

Run (from repo root): `npx create-next-app@14 apps/web --typescript --app --no-tailwind --no-eslint --src-dir --import-alias "@/*" --use-npm`
When prompted, accept defaults. This generates `apps/web/package.json`, `next.config.mjs`, `tsconfig.json`, and a starter `src/app/layout.tsx` / `src/app/page.tsx`.

- [ ] **Step 2: Add `@gazete/db` as a dependency of `apps/web`**

Edit `apps/web/package.json`, add to `dependencies`: `"@gazete/db": "*"`.
Run: `npm install` (from repo root).

- [ ] **Step 3: Configure Next.js to transpile the local `@gazete/db` package**

Next.js does not compile TypeScript from linked workspace packages by default (it treats them like ordinary `node_modules` and skips them) — without this, `npm run dev`/`next build` fail on the raw `.ts` source in `packages/db/src/index.ts`. Edit `apps/web/next.config.mjs` (generated by `create-next-app` in Step 1) so it reads:

```javascript
process.loadEnvFile(new URL("../../.env", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gazete/db"]
};

export default nextConfig;
```

The `process.loadEnvFile` line matters too: Next.js only auto-loads `.env` files from its own app directory (`apps/web/.env*`), not the monorepo root — and this project keeps a single `.env` at the repo root (see Task 2). Without this line, `DATABASE_URL`/`RESEND_API_KEY`/etc. are undefined when running `npm run dev --workspace=apps/web`. This mirrors the same fix already applied in root `vitest.config.ts` (Task 3) for the same underlying reason: `@prisma/client` and other libraries only read `process.env`, they don't load `.env` files themselves.

- [ ] **Step 4: Write the failing test — `apps/web/src/lib/token.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { generateToken } from "./token";

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different value each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run apps/web/src/lib/token.test.ts`
Expected: FAIL — `Cannot find module './token'`.

- [ ] **Step 6: Implement `apps/web/src/lib/token.ts`**

```typescript
import { randomBytes } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run apps/web/src/lib/token.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web package-lock.json
git commit -m "chore(web): scaffold Next.js app, transpile @gazete/db, and add token utility"
```

---

### Task 5: Honeypot + IP rate limit for subscribe

**Files:**
- Create: `apps/web/src/lib/rateLimit.ts`
- Test: `apps/web/src/lib/rateLimit.test.ts`

**Interfaces:**
- Produces: `isHoneypotTripped(honeypotValue: string | undefined): boolean` and `checkRateLimit(ip: string): boolean` (returns `true` if the request is allowed, `false` if the IP already made a request within the window).
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests — `apps/web/src/lib/rateLimit.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { isHoneypotTripped, checkRateLimit } from "./rateLimit";

describe("isHoneypotTripped", () => {
  it("is tripped when the honeypot field has any value", () => {
    expect(isHoneypotTripped("bot filled this")).toBe(true);
  });

  it("is not tripped when empty or undefined", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request from an IP", () => {
    expect(checkRateLimit("1.2.3.4")).toBe(true);
  });

  it("blocks a second request from the same IP within the window", () => {
    checkRateLimit("5.6.7.8");
    expect(checkRateLimit("5.6.7.8")).toBe(false);
  });

  it("allows a request from a different IP", () => {
    checkRateLimit("9.9.9.9");
    expect(checkRateLimit("8.8.8.8")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/lib/rateLimit.test.ts`
Expected: FAIL — `Cannot find module './rateLimit'`.

- [ ] **Step 3: Implement `apps/web/src/lib/rateLimit.ts`**

```typescript
const WINDOW_MS = 60_000;
const lastRequestAt = new Map<string, number>();

export function isHoneypotTripped(honeypotValue: string | undefined): boolean {
  return Boolean(honeypotValue && honeypotValue.length > 0);
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = lastRequestAt.get(ip);
  lastRequestAt.set(ip, now);
  if (last === undefined) return true;
  return now - last > WINDOW_MS;
}
```

Note: this is an in-process memory store, sufficient for the single-instance small-scale deployment described in the spec. If the web app ever runs multiple instances, this must move to a shared store (e.g. a `rate_limits` table).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/src/lib/rateLimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rateLimit.ts apps/web/src/lib/rateLimit.test.ts
git commit -m "feat(web): add honeypot and rate-limit helpers"
```

---

### Task 6: Email client wrapper (Resend)

**Files:**
- Create: `apps/web/src/lib/email.ts`
- Test: `apps/web/src/lib/email.test.ts`

**Interfaces:**
- Produces: `sendWelcomeEmail(to: string, preferencesToken: string): Promise<void>`, used by Task 7's subscribe route. Also used later by the worker's digest sender pattern (Task 19 reimplements its own send call in `apps/worker`, since the two apps don't share a runtime dependency on each other — only on `@gazete/db`).
- Consumes: `RESEND_API_KEY`, `FROM_EMAIL`, `BASE_URL` env vars.

- [ ] **Step 1: Add the `resend` dependency**

Edit `apps/web/package.json`, add to `dependencies`: `"resend": "^4.0.0"`.
Run: `npm install`.

- [ ] **Step 2: Write the failing test — `apps/web/src/lib/email.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "test" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock }
  }))
}));

import { sendWelcomeEmail } from "./email";

describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
    process.env.FROM_EMAIL = "Gazete <onboarding@resend.dev>";
    process.env.BASE_URL = "http://localhost:3000";
  });

  it("sends to the given address with a preferences link in the body", async () => {
    await sendWelcomeEmail("reader@example.com", "abc123");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("reader@example.com");
    expect(call.from).toBe("Gazete <onboarding@resend.dev>");
    expect(call.html).toContain("http://localhost:3000/preferences?token=abc123");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run apps/web/src/lib/email.test.ts`
Expected: FAIL — `Cannot find module './email'`.

- [ ] **Step 4: Implement `apps/web/src/lib/email.ts`**

```typescript
import { Resend } from "resend";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWelcomeEmail(to: string, preferencesToken: string): Promise<void> {
  const baseUrl = process.env.BASE_URL;
  const preferencesUrl = `${baseUrl}/preferences?token=${preferencesToken}`;

  await getClient().emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: "Gazete'ye hoş geldin",
    html: `
      <p>Gazete'ye abone oldun. Her sabah 09:00'da seçtiğin kategorilerden bir bülten alacaksın.</p>
      <p>Tercihlerini istediğin zaman <a href="${preferencesUrl}">buradan</a> güncelleyebilirsin.</p>
    `
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run apps/web/src/lib/email.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/lib/email.ts apps/web/src/lib/email.test.ts
git commit -m "feat(web): add Resend email client wrapper"
```

---

### Task 7: `POST /api/subscribe`

**Files:**
- Create: `apps/web/src/app/api/subscribe/route.ts`
- Test: `apps/web/src/app/api/subscribe/route.test.ts`

**Interfaces:**
- Consumes: `generateToken()` (Task 4), `isHoneypotTripped`/`checkRateLimit` (Task 5), `sendWelcomeEmail` (Task 6), `prisma` (Task 3).
- Produces: `POST /api/subscribe` accepting `{ email: string, categories: string[], honeypot?: string }`, returns `201` on success, `400` on validation error, `429` on rate limit.

- [ ] **Step 1: Write the failing test — `apps/web/src/app/api/subscribe/route.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";
import { sendWelcomeEmail } from "@/lib/email";

function makeRequest(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost:3000/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body)
  });
}

describe("POST /api/subscribe", () => {
  beforeEach(async () => {
    vi.mocked(sendWelcomeEmail).mockClear();
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
  });

  it("creates an active subscriber with categories and sends a welcome email", async () => {
    const res = await POST(makeRequest({ email: "new@example.com", categories: ["ekonomi", "spor"] }, "2.2.2.2"));
    expect(res.status).toBe(201);

    const sub = await prisma.subscriber.findUnique({
      where: { email: "new@example.com" },
      include: { categories: true }
    });
    expect(sub?.status).toBe("active");
    expect(sub?.categories.map((c) => c.category).sort()).toEqual(["ekonomi", "spor"]);
    expect(sendWelcomeEmail).toHaveBeenCalledWith("new@example.com", sub?.preferencesToken);
  });

  it("updates categories in place if the email already exists, without a second welcome email", async () => {
    await POST(makeRequest({ email: "repeat@example.com", categories: ["gundem"] }, "3.3.3.3"));
    vi.mocked(sendWelcomeEmail).mockClear();

    const res = await POST(makeRequest({ email: "repeat@example.com", categories: ["teknoloji"] }, "4.4.4.4"));
    expect(res.status).toBe(201);

    const subs = await prisma.subscriber.findMany({ where: { email: "repeat@example.com" } });
    expect(subs).toHaveLength(1);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid email with 400", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", categories: ["gundem"] }, "5.5.5.5"));
    expect(res.status).toBe(400);
  });

  it("rejects an empty categories list with 400", async () => {
    const res = await POST(makeRequest({ email: "valid@example.com", categories: [] }, "6.6.6.6"));
    expect(res.status).toBe(400);
  });

  it("silently accepts (200) but does not create a row when the honeypot is filled", async () => {
    const res = await POST(makeRequest({ email: "bot@example.com", categories: ["gundem"], honeypot: "x" }, "7.7.7.7"));
    expect(res.status).toBe(201);
    const sub = await prisma.subscriber.findUnique({ where: { email: "bot@example.com" } });
    expect(sub).toBeNull();
  });

  it("returns 429 on a second request from the same IP within the window", async () => {
    await POST(makeRequest({ email: "a@example.com", categories: ["gundem"] }, "8.8.8.8"));
    const res = await POST(makeRequest({ email: "b@example.com", categories: ["gundem"] }, "8.8.8.8"));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/subscribe/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `apps/web/src/app/api/subscribe/route.ts`**

```typescript
import { prisma, Category } from "@gazete/db";
import { generateToken } from "@/lib/token";
import { isHoneypotTripped, checkRateLimit } from "@/lib/rateLimit";
import { sendWelcomeEmail } from "@/lib/email";

const VALID_CATEGORIES = Object.values(Category);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const body = await request.json();
  const { email, categories, honeypot } = body as {
    email?: string;
    categories?: string[];
    honeypot?: string;
  };

  if (isHoneypotTripped(honeypot)) {
    // Pretend success so the bot doesn't learn anything, but do nothing.
    return Response.json({ ok: true }, { status: 201 });
  }

  if (!checkRateLimit(ip)) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  if (!categories || categories.length === 0 || !categories.every((c) => VALID_CATEGORIES.includes(c as Category))) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }

  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    await prisma.subscriberCategory.deleteMany({ where: { subscriberId: existing.id } });
    await prisma.subscriberCategory.createMany({
      data: categories.map((category) => ({ subscriberId: existing.id, category: category as Category }))
    });
    return Response.json({ ok: true }, { status: 201 });
  }

  const preferencesToken = generateToken();
  const subscriber = await prisma.subscriber.create({
    data: {
      email,
      preferencesToken,
      categories: {
        create: categories.map((category) => ({ category: category as Category }))
      }
    }
  });

  await sendWelcomeEmail(subscriber.email, preferencesToken);

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/subscribe/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/subscribe
git commit -m "feat(web): add POST /api/subscribe"
```

---

### Task 8: Subscribe page UI

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/SubscribeForm.tsx`

**Interfaces:**
- Consumes: `POST /api/subscribe` (Task 7).
- Produces: the public landing page with the subscribe form.

- [ ] **Step 1: Create `apps/web/src/app/SubscribeForm.tsx`**

```tsx
"use client";

import { useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "gundem", label: "Gündem" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "teknoloji", label: "Teknoloji" },
  { value: "spor", label: "Spor" },
  { value: "dunya", label: "Dünya" },
  { value: "saglik", label: "Sağlık" },
  { value: "kultur_sanat", label: "Kültür-Sanat" }
];

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, categories: selected, honeypot: "" })
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return <p>Teşekkürler! Yarın sabah 09:00&apos;dan itibaren bültenini almaya başlayacaksın.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">E-posta</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <fieldset>
        <legend>İlgilendiğin kategoriler</legend>
        {CATEGORIES.map((c) => (
          <label key={c.value}>
            <input
              type="checkbox"
              checked={selected.includes(c.value)}
              onChange={() => toggle(c.value)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      {/* honeypot: hidden from real users, bots tend to fill every field */}
      <input type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

      <button type="submit" disabled={status === "loading" || selected.length === 0}>
        Abone Ol
      </button>
      {status === "error" && <p role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
    </form>
  );
}
```

- [ ] **Step 2: Replace `apps/web/src/app/page.tsx`**

```tsx
import { SubscribeForm } from "./SubscribeForm";

export default function HomePage() {
  return (
    <main>
      <h1>Gazete</h1>
      <p>Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük Türkçe haber bülteni.</p>
      <SubscribeForm />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web`
Open `http://localhost:3000`, select at least one category, submit with your own email.
Expected: success message shown, a row appears in the `subscribers` table (check with `npx prisma studio --schema=packages/db/prisma/schema.prisma`), and a welcome email arrives (once `RESEND_API_KEY`/`FROM_EMAIL` are set in `.env` — see Task 6).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/SubscribeForm.tsx
git commit -m "feat(web): add subscribe page UI"
```

---

### Task 9: `GET`/`POST /api/preferences` and the preferences page

**Files:**
- Create: `apps/web/src/app/api/preferences/route.ts`
- Create: `apps/web/src/app/preferences/page.tsx`
- Create: `apps/web/src/app/preferences/PreferencesForm.tsx`
- Test: `apps/web/src/app/api/preferences/route.test.ts`

**Interfaces:**
- Produces: `GET /api/preferences?token=...` → `{ email, categories: string[] }` or `404`; `POST /api/preferences` with `{ token, categories }` → `200` or `404`/`400`.
- Consumes: `prisma` (Task 3).

- [ ] **Step 1: Write the failing tests — `apps/web/src/app/api/preferences/route.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateToken } from "@/lib/token";
import { GET, POST } from "./route";

async function makeSubscriber(categories: string[] = ["gundem"]) {
  const token = generateToken();
  const sub = await prisma.subscriber.create({
    data: {
      email: `pref-${Date.now()}-${Math.random()}@example.com`,
      preferencesToken: token,
      categories: { create: categories.map((category) => ({ category: category as any })) }
    }
  });
  return { sub, token };
}

describe("GET /api/preferences", () => {
  beforeEach(async () => {
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
  });

  it("returns the subscriber's email and categories for a valid token", async () => {
    const { sub, token } = await makeSubscriber(["ekonomi", "spor"]);
    const res = await GET(new Request(`http://localhost:3000/api/preferences?token=${token}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.email).toBe(sub.email);
    expect(json.categories.sort()).toEqual(["ekonomi", "spor"]);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await GET(new Request("http://localhost:3000/api/preferences?token=doesnotexist"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/preferences", () => {
  beforeEach(async () => {
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
  });

  it("replaces the subscriber's categories", async () => {
    const { sub, token } = await makeSubscriber(["gundem"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["teknoloji", "dunya"] })
      })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.subscriberCategory.findMany({ where: { subscriberId: sub.id } });
    expect(updated.map((c) => c.category).sort()).toEqual(["dunya", "teknoloji"]);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "doesnotexist", categories: ["gundem"] })
      })
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/app/api/preferences/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `apps/web/src/app/api/preferences/route.ts`**

```typescript
import { prisma, Category } from "@gazete/db";

const VALID_CATEGORIES = Object.values(Category);

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

  const subscriber = await prisma.subscriber.findUnique({
    where: { preferencesToken: token },
    include: { categories: true }
  });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    email: subscriber.email,
    categories: subscriber.categories.map((c) => c.category)
  });
}

export async function POST(request: Request): Promise<Response> {
  const { token, categories } = (await request.json()) as { token?: string; categories?: string[] };

  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });
  if (!categories || categories.length === 0 || !categories.every((c) => VALID_CATEGORIES.includes(c as Category))) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.findUnique({ where: { preferencesToken: token } });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.subscriberCategory.deleteMany({ where: { subscriberId: subscriber.id } });
  await prisma.subscriberCategory.createMany({
    data: categories.map((category) => ({ subscriberId: subscriber.id, category: category as Category }))
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/src/app/api/preferences/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `apps/web/src/app/preferences/PreferencesForm.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "gundem", label: "Gündem" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "teknoloji", label: "Teknoloji" },
  { value: "spor", label: "Spor" },
  { value: "dunya", label: "Dünya" },
  { value: "saglik", label: "Sağlık" },
  { value: "kultur_sanat", label: "Kültür-Sanat" }
];

export function PreferencesForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/preferences?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setSelected(json.categories);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, categories: selected })
    });
    setSaved(res.ok);
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (notFound) return <p>Bu bağlantı geçersiz.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>Kategorilerin</legend>
        {CATEGORIES.map((c) => (
          <label key={c.value}>
            <input type="checkbox" checked={selected.includes(c.value)} onChange={() => toggle(c.value)} />
            {c.label}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={selected.length === 0}>Kaydet</button>
      {saved && <p>Kaydedildi.</p>}
    </form>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/app/preferences/page.tsx`**

```tsx
import { PreferencesForm } from "./PreferencesForm";

export default function PreferencesPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p>Eksik bağlantı.</p>;
  return (
    <main>
      <h1>Tercihlerini Güncelle</h1>
      <PreferencesForm token={searchParams.token} />
    </main>
  );
}
```

- [ ] **Step 7: Manually verify in the browser**

With `npm run dev --workspace=apps/web` running, subscribe via the homepage, copy the `preferencesToken` from Prisma Studio, open `http://localhost:3000/preferences?token=<token>`, change categories, save, and confirm the DB row changed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/preferences apps/web/src/app/preferences
git commit -m "feat(web): add preferences API and page"
```

---

### Task 10: `POST /api/unsubscribe` and the unsubscribe page

**Files:**
- Create: `apps/web/src/app/api/unsubscribe/route.ts`
- Create: `apps/web/src/app/unsubscribe/page.tsx`
- Test: `apps/web/src/app/api/unsubscribe/route.test.ts`

**Interfaces:**
- Produces: `POST /api/unsubscribe` with `{ token }` → sets `status = "unsubscribed"`, returns `200`/`404`.

- [ ] **Step 1: Write the failing test — `apps/web/src/app/api/unsubscribe/route.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateToken } from "@/lib/token";
import { POST } from "./route";

describe("POST /api/unsubscribe", () => {
  beforeEach(async () => {
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
  });

  it("marks the subscriber unsubscribed", async () => {
    const token = generateToken();
    const sub = await prisma.subscriber.create({
      data: { email: `unsub-${Date.now()}@example.com`, preferencesToken: token }
    });

    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(updated?.status).toBe("unsubscribed");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "doesnotexist" })
      })
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/unsubscribe/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `apps/web/src/app/api/unsubscribe/route.ts`**

```typescript
import { prisma } from "@gazete/db";

export async function POST(request: Request): Promise<Response> {
  const { token } = (await request.json()) as { token?: string };
  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

  const subscriber = await prisma.subscriber.findUnique({ where: { preferencesToken: token } });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: "unsubscribed" } });

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/unsubscribe/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `apps/web/src/app/unsubscribe/page.tsx`**

This calls the API directly from a server component on load — a single visit to the link is enough to unsubscribe (RFC 8058 one-click), no extra confirmation click.

```tsx
async function unsubscribe(token: string) {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/unsubscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store"
  });
  return res.ok;
}

export default async function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p>Eksik bağlantı.</p>;
  const ok = await unsubscribe(searchParams.token);
  return <main>{ok ? <p>Abonelikten çıkıldı. İyi günler dileriz.</p> : <p>Bu bağlantı geçersiz.</p>}</main>;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/unsubscribe apps/web/src/app/unsubscribe
git commit -m "feat(web): add one-click unsubscribe"
```

---

### Task 11: Resend bounce webhook

**Files:**
- Create: `apps/web/src/app/api/webhooks/resend/route.ts`
- Test: `apps/web/src/app/api/webhooks/resend/route.test.ts`

**Interfaces:**
- Produces: `POST /api/webhooks/resend`, verifies the Svix signature Resend sends, and on an `email.bounced` event with a matching subscriber email sets `status = "unsubscribed"`.
- Consumes: `RESEND_WEBHOOK_SECRET` env var.

- [ ] **Step 1: Add the `svix` dependency (Resend signs webhooks with Svix)**

Edit `apps/web/package.json`, add to `dependencies`: `"svix": "^1.42.0"`.
Run: `npm install`.

- [ ] **Step 2: Write the failing test — `apps/web/src/app/api/webhooks/resend/route.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateToken } from "@/lib/token";

vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: (payload: string) => JSON.parse(payload)
  }))
}));

import { POST } from "./route";

describe("POST /api/webhooks/resend", () => {
  beforeEach(async () => {
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  });

  it("unsubscribes the matching subscriber on email.bounced", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "bounced@example.com", preferencesToken: generateToken() }
    });

    const payload = JSON.stringify({ type: "email.bounced", data: { to: ["bounced@example.com"] } });
    const res = await POST(
      new Request("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        headers: { "svix-id": "1", "svix-timestamp": "1", "svix-signature": "sig" },
        body: payload
      })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(updated?.status).toBe("unsubscribed");
  });

  it("ignores unrelated event types", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "delivered@example.com", preferencesToken: generateToken() }
    });

    const payload = JSON.stringify({ type: "email.delivered", data: { to: ["delivered@example.com"] } });
    await POST(
      new Request("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        headers: { "svix-id": "1", "svix-timestamp": "1", "svix-signature": "sig" },
        body: payload
      })
    );

    const unchanged = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(unchanged?.status).toBe("active");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/app/api/webhooks/resend/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 4: Implement `apps/web/src/app/api/webhooks/resend/route.ts`**

```typescript
import { Webhook } from "svix";
import { prisma } from "@gazete/db";

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? ""
  };

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET as string);
  let event: { type: string; data: { to: string[] } };
  try {
    event = wh.verify(payload, headers) as typeof event;
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "email.bounced") {
    const [email] = event.data.to;
    await prisma.subscriber.updateMany({
      where: { email },
      data: { status: "unsubscribed" }
    });
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run apps/web/src/app/api/webhooks/resend/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/app/api/webhooks
git commit -m "feat(web): unsubscribe on Resend bounce webhook"
```

---

## Phase 3 — Worker: RSS fetch, dedupe, summarize

### Task 12: Scaffold `apps/worker`

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`
- Create: `apps/worker/src/config.ts`

**Interfaces:**
- Produces: `config` object with `{ timezone: "Europe/Istanbul", anthropicApiKey, resendApiKey, fromEmail, baseUrl }` read from env, used by every later worker task.

- [ ] **Step 1: Create `apps/worker/package.json`**

```json
{
  "name": "@gazete/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dry-run": "tsx src/index.ts --dry-run"
  },
  "dependencies": {
    "@gazete/db": "*",
    "@anthropic-ai/sdk": "^0.27.0",
    "resend": "^4.0.0",
    "rss-parser": "^3.13.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "tsx": "^4.16.5",
    "@types/node-cron": "^3.0.11"
  }
}
```

- [ ] **Step 2: Create `apps/worker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/worker/src/config.ts`**

Unlike Vitest (fixed in Task 3's `vitest.config.ts`) and Next.js (fixed in Task 4's `next.config.mjs`), the worker runs via plain `tsx src/index.ts` with no framework that auto-loads `.env` — so this file loads it itself, from the repo root, before reading any `process.env` value:

```typescript
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // .env not present (e.g. production, where real env vars are injected) — ignore.
}

export const config = {
  timezone: "Europe/Istanbul",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY as string,
  resendApiKey: process.env.RESEND_API_KEY as string,
  fromEmail: process.env.FROM_EMAIL as string,
  baseUrl: process.env.BASE_URL as string
};
```

- [ ] **Step 4: Install**

Run: `npm install` (from repo root).

- [ ] **Step 5: Commit**

```bash
git add apps/worker package-lock.json
git commit -m "chore(worker): scaffold worker app"
```

---

### Task 13: Seed initial RSS sources

**Files:**
- Create: `packages/db/prisma/seed.ts`
- Modify: `packages/db/package.json` (add `prisma.seed` config)

**Interfaces:**
- Produces: populated `sources` table, consumed by Task 14's fetch job.

- [ ] **Step 1: Create `packages/db/prisma/seed.ts`**

The RSS URLs below are a starting point based on each outlet's known section-feed pattern — **verify each one resolves and returns valid RSS before relying on it in production** (open each URL in a browser once); outlets occasionally restructure their feed URLs.

```typescript
import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

const sources: { name: string; rssUrl: string; category: Category }[] = [
  { name: "AA Güncel", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=guncel", category: "gundem" },
  { name: "AA Ekonomi", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi", category: "ekonomi" },
  { name: "AA Spor", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=spor", category: "spor" },
  { name: "Hürriyet Gündem", rssUrl: "https://www.hurriyet.com.tr/rss/gundem", category: "gundem" },
  { name: "Hürriyet Ekonomi", rssUrl: "https://www.hurriyet.com.tr/rss/ekonomi", category: "ekonomi" },
  { name: "Hürriyet Teknoloji", rssUrl: "https://www.hurriyet.com.tr/rss/teknoloji", category: "teknoloji" },
  { name: "Hürriyet Dünya", rssUrl: "https://www.hurriyet.com.tr/rss/dunya", category: "dunya" },
  { name: "NTV Sağlık", rssUrl: "https://www.ntv.com.tr/saglik.rss", category: "saglik" },
  { name: "NTV Sanat", rssUrl: "https://www.ntv.com.tr/sanat.rss", category: "kultur_sanat" }
];

async function main() {
  for (const source of sources) {
    await prisma.source.upsert({
      where: { rssUrl: source.rssUrl },
      update: { name: source.name, category: source.category, active: true },
      create: source
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Wire the seed script into `packages/db/package.json`**

Add a top-level key (sibling of `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Add `"tsx": "^4.16.5"` to `devDependencies`.
Run: `npm install`.

- [ ] **Step 3: Run the seed and verify**

Run: `npx prisma db seed --schema=packages/db/prisma/schema.prisma`
Expected: no errors. Verify with `npx prisma studio --schema=packages/db/prisma/schema.prisma` that `sources` has 9 rows.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/seed.ts packages/db/package.json package-lock.json
git commit -m "feat(db): seed initial RSS sources"
```

---

### Task 14: RSS fetch job

**Files:**
- Create: `apps/worker/src/fetchRss.ts`
- Test: `apps/worker/src/fetchRss.test.ts`

**Interfaces:**
- Produces: `fetchAllSources(): Promise<{ sourceId: string; sourceName: string; error: string }[]>` — runs the fetch for every active source, stores new `Article` rows (skipping URLs already in the DB), returns a list of per-source errors (empty array if none). Errors are returned, not thrown, so one dead feed cannot stop the others.
- Consumes: `prisma` (Task 3), `Source`/`Article` models.

- [ ] **Step 1: Write the failing tests — `apps/worker/src/fetchRss.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

const parseURLMock = vi.fn();
vi.mock("rss-parser", () => ({
  default: vi.fn().mockImplementation(() => ({ parseURL: parseURLMock }))
}));

import { fetchAllSources } from "./fetchRss";

describe("fetchAllSources", () => {
  beforeEach(async () => {
    parseURLMock.mockReset();
    await prisma.storyArticle.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("stores new articles from an active source", async () => {
    const source = await prisma.source.create({
      data: { name: "Test", rssUrl: "https://example.com/rss", category: "gundem" }
    });
    parseURLMock.mockResolvedValue({
      items: [
        { link: "https://example.com/a1", title: "Haber 1", isoDate: "2026-09-08T06:00:00Z", contentSnippet: "özet" }
      ]
    });

    const errors = await fetchAllSources();
    expect(errors).toEqual([]);

    const articles = await prisma.article.findMany({ where: { sourceId: source.id } });
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Haber 1");
  });

  it("skips articles whose URL already exists", async () => {
    const source = await prisma.source.create({
      data: { name: "Test", rssUrl: "https://example.com/rss2", category: "gundem" }
    });
    await prisma.article.create({
      data: { sourceId: source.id, url: "https://example.com/a1", title: "Eski", publishedAt: new Date() }
    });
    parseURLMock.mockResolvedValue({
      items: [{ link: "https://example.com/a1", title: "Haber 1", isoDate: "2026-09-08T06:00:00Z" }]
    });

    await fetchAllSources();
    const articles = await prisma.article.findMany({ where: { sourceId: source.id } });
    expect(articles).toHaveLength(1);
  });

  it("skips inactive sources", async () => {
    await prisma.source.create({
      data: { name: "Inactive", rssUrl: "https://example.com/rss3", category: "gundem", active: false }
    });

    await fetchAllSources();
    expect(parseURLMock).not.toHaveBeenCalled();
  });

  it("returns an error for a source instead of throwing, and still processes others", async () => {
    const bad = await prisma.source.create({
      data: { name: "Bad", rssUrl: "https://example.com/bad", category: "gundem" }
    });
    const good = await prisma.source.create({
      data: { name: "Good", rssUrl: "https://example.com/good", category: "spor" }
    });
    parseURLMock.mockImplementation(async (url: string) => {
      if (url === bad.rssUrl) throw new Error("timeout");
      return { items: [{ link: "https://example.com/g1", title: "Spor Haberi", isoDate: "2026-09-08T06:00:00Z" }] };
    });

    const errors = await fetchAllSources();
    expect(errors).toHaveLength(1);
    expect(errors[0].sourceId).toBe(bad.id);

    const goodArticles = await prisma.article.findMany({ where: { sourceId: good.id } });
    expect(goodArticles).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/fetchRss.test.ts`
Expected: FAIL — `Cannot find module './fetchRss'`.

- [ ] **Step 3: Implement `apps/worker/src/fetchRss.ts`**

```typescript
import Parser from "rss-parser";
import { prisma } from "@gazete/db";

const parser = new Parser();

export async function fetchAllSources(): Promise<{ sourceId: string; sourceName: string; error: string }[]> {
  const sources = await prisma.source.findMany({ where: { active: true } });
  const errors: { sourceId: string; sourceName: string; error: string }[] = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.rssUrl);

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        const alreadyExists = await prisma.article.findUnique({ where: { url: item.link } });
        if (alreadyExists) continue;

        await prisma.article.create({
          data: {
            sourceId: source.id,
            url: item.link,
            title: item.title,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
            rawDescription: item.contentSnippet ?? null
          }
        });
      }
    } catch (err) {
      errors.push({ sourceId: source.id, sourceName: source.name, error: (err as Error).message });
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/fetchRss.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/fetchRss.ts apps/worker/src/fetchRss.test.ts
git commit -m "feat(worker): add RSS fetch job"
```

---

### Task 15: Title similarity (Jaccard) dedupe function

**Files:**
- Create: `apps/worker/src/similarity.ts`
- Test: `apps/worker/src/similarity.test.ts`

**Interfaces:**
- Produces: `titleSimilarity(a: string, b: string): number` (0 to 1), used by Task 16 to find a matching existing `Story`.

- [ ] **Step 1: Write the failing tests — `apps/worker/src/similarity.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { titleSimilarity } from "./similarity";

describe("titleSimilarity", () => {
  it("returns 1 for identical titles", () => {
    expect(titleSimilarity("Merkez Bankası faiz kararını açıkladı", "Merkez Bankası faiz kararını açıkladı")).toBe(1);
  });

  it("returns a high score for near-duplicate headlines about the same event", () => {
    const a = "Merkez Bankası faiz kararını açıkladı";
    const b = "Merkez Bankası'ndan faiz kararı açıklaması geldi";
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.5);
  });

  it("returns a low score for unrelated headlines", () => {
    const a = "Merkez Bankası faiz kararını açıkladı";
    const b = "Galatasaray derbide 3 gol attı";
    expect(titleSimilarity(a, b)).toBeLessThan(0.2);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(titleSimilarity("Ali, İstanbul'a gitti!", "ali istanbula gitti")).toBeGreaterThan(0.7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/similarity.test.ts`
Expected: FAIL — `Cannot find module './similarity'`.

- [ ] **Step 3: Implement `apps/worker/src/similarity.ts`**

```typescript
function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((token) => token.length > 0)
  );
}

export function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 && tokensB.size === 0) return 1;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/similarity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/similarity.ts apps/worker/src/similarity.test.ts
git commit -m "feat(worker): add Jaccard title similarity for dedupe"
```

---

### Task 16: Claude summarization client + story clustering

**Files:**
- Create: `apps/worker/src/summarize.ts`
- Create: `apps/worker/src/processArticles.ts`
- Test: `apps/worker/src/processArticles.test.ts`

**Interfaces:**
- Consumes: `titleSimilarity` (Task 15), `prisma` (Task 3), `config.anthropicApiKey` (Task 12).
- Produces: `processNewArticles(): Promise<void>` — for every `Article` not yet linked to a `Story` (via `StoryArticle`), either attaches it to a same-day/same-category `Story` whose `canonicalTitle` scores `>= 0.5` similarity, or creates a new `Story` with a Claude-generated `aiSummaryTr`.

- [ ] **Step 1: Create `apps/worker/src/summarize.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

export async function summarizeArticle(title: string, description: string | null): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Aşağıdaki haberi 2-3 cümlelik tarafsız bir Türkçe özet haline getir. Sadece özeti yaz, başka açıklama ekleme.\n\nBaşlık: ${title}\nAçıklama: ${description ?? "(yok)"}`
      }
    ]
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : title;
}
```

- [ ] **Step 2: Write the failing tests — `apps/worker/src/processArticles.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("./summarize", () => ({ summarizeArticle: vi.fn().mockResolvedValue("Bu bir test özetidir.") }));

import { processNewArticles } from "./processArticles";
import { summarizeArticle } from "./summarize";

async function makeArticle(sourceOverrides: Partial<{ category: any }> = {}, title = "Test Başlık") {
  const source = await prisma.source.create({
    data: { name: "Src", rssUrl: `https://example.com/${Date.now()}-${Math.random()}`, category: sourceOverrides.category ?? "gundem" }
  });
  return prisma.article.create({
    data: {
      sourceId: source.id,
      url: `https://example.com/${Date.now()}-${Math.random()}`,
      title,
      publishedAt: new Date()
    }
  });
}

describe("processNewArticles", () => {
  beforeEach(async () => {
    vi.mocked(summarizeArticle).mockClear();
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("creates a new story with an AI summary for an unmatched article", async () => {
    const article = await makeArticle({}, "Benzersiz Bir Haber Başlığı");

    await processNewArticles();

    const links = await prisma.storyArticle.findMany({ where: { articleId: article.id }, include: { story: true } });
    expect(links).toHaveLength(1);
    expect(links[0].story.aiSummaryTr).toBe("Bu bir test özetidir.");
    expect(summarizeArticle).toHaveBeenCalledTimes(1);
  });

  it("attaches a similar same-day same-category article to the existing story without a second AI call", async () => {
    await makeArticle({}, "Merkez Bankası faiz kararını açıkladı");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    const second = await makeArticle({}, "Merkez Bankası'ndan faiz kararı açıklaması geldi");
    await processNewArticles();

    const stories = await prisma.story.findMany({ include: { storyArticles: true } });
    expect(stories).toHaveLength(1);
    expect(stories[0].storyArticles.map((sa) => sa.articleId)).toContain(second.id);
    expect(summarizeArticle).not.toHaveBeenCalled();
  });

  it("does not match across different categories even with an identical title", async () => {
    await makeArticle({ category: "gundem" }, "Aynı Başlık");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    await makeArticle({ category: "spor" }, "Aynı Başlık");
    await processNewArticles();

    const stories = await prisma.story.findMany();
    expect(stories).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/processArticles.test.ts`
Expected: FAIL — `Cannot find module './processArticles'`.

- [ ] **Step 4: Implement `apps/worker/src/processArticles.ts`**

```typescript
import { prisma } from "@gazete/db";
import { titleSimilarity } from "./similarity";
import { summarizeArticle } from "./summarize";

const SIMILARITY_THRESHOLD = 0.5;

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function processNewArticles(): Promise<void> {
  const unprocessed = await prisma.article.findMany({
    where: { storyArticles: { none: {} } },
    include: { source: true }
  });

  for (const article of unprocessed) {
    const todaysStories = await prisma.story.findMany({
      where: { category: article.source.category, digestDate: { gte: startOfToday() } }
    });

    const match = todaysStories.find(
      (story) => titleSimilarity(story.canonicalTitle, article.title) >= SIMILARITY_THRESHOLD
    );

    if (match) {
      await prisma.storyArticle.create({ data: { storyId: match.id, articleId: article.id } });
      continue;
    }

    const summary = await summarizeArticle(article.title, article.rawDescription);
    await prisma.story.create({
      data: {
        category: article.source.category,
        canonicalTitle: article.title,
        aiSummaryTr: summary,
        digestDate: startOfToday(),
        storyArticles: { create: { articleId: article.id } }
      }
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/processArticles.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/summarize.ts apps/worker/src/processArticles.ts apps/worker/src/processArticles.test.ts
git commit -m "feat(worker): add Claude summarization and story clustering"
```

---

## Phase 4 — Digest generation and send

### Task 17: Digest query

**Files:**
- Create: `apps/worker/src/digestQuery.ts`
- Test: `apps/worker/src/digestQuery.test.ts`

**Interfaces:**
- Produces: `getStoriesForSubscriber(subscriberId: string, digestDate: Date): Promise<StoryWithSources[]>` where `StoryWithSources = { id: string; category: string; aiSummaryTr: string; sources: { name: string; url: string }[] }`.

- [ ] **Step 1: Write the failing tests — `apps/worker/src/digestQuery.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateTestToken } from "./testUtils";
import { getStoriesForSubscriber } from "./digestQuery";

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("getStoriesForSubscriber", () => {
  beforeEach(async () => {
    await prisma.digestSend.deleteMany({});
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("returns only today's stories in the subscriber's chosen categories, with source links", async () => {
    const subscriber = await prisma.subscriber.create({
      data: {
        email: "digest@example.com",
        preferencesToken: generateTestToken(),
        categories: { create: [{ category: "ekonomi" }] }
      }
    });

    const source = await prisma.source.create({
      data: { name: "AA", rssUrl: "https://example.com/rss-" + Date.now(), category: "ekonomi" }
    });
    const article = await prisma.article.create({
      data: { sourceId: source.id, url: "https://example.com/story1", title: "Faiz kararı", publishedAt: new Date() }
    });
    const story = await prisma.story.create({
      data: {
        category: "ekonomi",
        canonicalTitle: "Faiz kararı",
        aiSummaryTr: "Özet metni.",
        digestDate: today(),
        storyArticles: { create: { articleId: article.id } }
      }
    });

    await prisma.story.create({
      data: { category: "spor", canonicalTitle: "Maç sonucu", aiSummaryTr: "Spor özeti.", digestDate: today() }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(story.id);
    expect(result[0].sources).toEqual([{ name: "AA", url: "https://example.com/story1" }]);
  });

  it("returns an empty array when there are no matching stories", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "empty@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "spor" }] } }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Create the small test helper `apps/worker/src/testUtils.ts`**

```typescript
import { randomBytes } from "node:crypto";

export function generateTestToken(): string {
  return randomBytes(16).toString("hex");
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/digestQuery.test.ts`
Expected: FAIL — `Cannot find module './digestQuery'`.

- [ ] **Step 4: Implement `apps/worker/src/digestQuery.ts`**

```typescript
import { prisma } from "@gazete/db";

export interface StoryWithSources {
  id: string;
  category: string;
  aiSummaryTr: string;
  sources: { name: string; url: string }[];
}

export async function getStoriesForSubscriber(subscriberId: string, digestDate: Date): Promise<StoryWithSources[]> {
  const categories = await prisma.subscriberCategory.findMany({ where: { subscriberId } });
  if (categories.length === 0) return [];

  const stories = await prisma.story.findMany({
    where: {
      digestDate,
      category: { in: categories.map((c) => c.category) }
    },
    include: {
      storyArticles: { include: { article: { include: { source: true } } } }
    }
  });

  return stories
    .filter((story) => story.aiSummaryTr !== null)
    .map((story) => ({
      id: story.id,
      category: story.category,
      aiSummaryTr: story.aiSummaryTr as string,
      sources: story.storyArticles.map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
    }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/digestQuery.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/digestQuery.ts apps/worker/src/digestQuery.test.ts apps/worker/src/testUtils.ts
git commit -m "feat(worker): add per-subscriber digest query"
```

---

### Task 18: Turkish HTML digest email template

**Files:**
- Create: `apps/worker/src/renderDigest.ts`
- Test: `apps/worker/src/renderDigest.test.ts`

**Interfaces:**
- Consumes: `StoryWithSources[]` (Task 17).
- Produces: `renderDigestHtml(stories: StoryWithSources[], preferencesToken: string, baseUrl: string): string`.

- [ ] **Step 1: Write the failing tests — `apps/worker/src/renderDigest.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { renderDigestHtml } from "./renderDigest";
import type { StoryWithSources } from "./digestQuery";

describe("renderDigestHtml", () => {
  const stories: StoryWithSources[] = [
    {
      id: "1",
      category: "ekonomi",
      aiSummaryTr: "Merkez Bankası faizi sabit tuttu.",
      sources: [{ name: "AA", url: "https://example.com/a" }, { name: "NTV", url: "https://example.com/b" }]
    }
  ];

  it("includes each story's summary and every source link", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("Merkez Bankası faizi sabit tuttu.");
    expect(html).toContain("https://example.com/a");
    expect(html).toContain("https://example.com/b");
  });

  it("includes the preferences and unsubscribe links built from the token and base URL", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("https://gazete.example.com/preferences?token=tok123");
    expect(html).toContain("https://gazete.example.com/unsubscribe?token=tok123");
  });

  it("escapes HTML in the summary to prevent injection", () => {
    const malicious: StoryWithSources[] = [
      { id: "2", category: "gundem", aiSummaryTr: "<script>alert(1)</script>", sources: [] }
    ];
    const html = renderDigestHtml(malicious, "tok123", "https://gazete.example.com");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/renderDigest.test.ts`
Expected: FAIL — `Cannot find module './renderDigest'`.

- [ ] **Step 3: Implement `apps/worker/src/renderDigest.ts`**

```typescript
import type { StoryWithSources } from "./digestQuery";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_LABELS: Record<string, string> = {
  gundem: "Gündem",
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

export function renderDigestHtml(stories: StoryWithSources[], preferencesToken: string, baseUrl: string): string {
  const storiesHtml = stories
    .map(
      (story) => `
        <div>
          <p><strong>[${CATEGORY_LABELS[story.category] ?? story.category}]</strong></p>
          <p>${escapeHtml(story.aiSummaryTr)}</p>
          <p>${story.sources
            .map((s) => `<a href="${s.url}">${escapeHtml(s.name)}</a>`)
            .join(" &middot; ")}</p>
        </div>
      `
    )
    .join("<hr />");

  return `
    <html>
      <body>
        <h1>Bugünkü Gazete'n</h1>
        ${storiesHtml || "<p>Bugün seçtiğin kategorilerde yeni haber yok.</p>"}
        <hr />
        <p>
          <a href="${baseUrl}/preferences?token=${preferencesToken}">Tercihlerini güncelle</a>
          &middot;
          <a href="${baseUrl}/unsubscribe?token=${preferencesToken}">Abonelikten çık</a>
        </p>
      </body>
    </html>
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/renderDigest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/renderDigest.ts apps/worker/src/renderDigest.test.ts
git commit -m "feat(worker): add Turkish digest email template"
```

---

### Task 19: Send digest job with idempotency and retry

**Files:**
- Create: `apps/worker/src/sendDigest.ts`
- Test: `apps/worker/src/sendDigest.test.ts`

**Interfaces:**
- Consumes: `getStoriesForSubscriber` (Task 17), `renderDigestHtml` (Task 18), `config` (Task 12).
- Produces: `sendDailyDigest(options?: { dryRun?: boolean }): Promise<void>` — for every `active` subscriber, skips if a `DigestSend` for today already has `status = "sent"`, otherwise renders and sends (or logs, in dry-run) and upserts the `DigestSend` row.

- [ ] **Step 1: Write the failing tests — `apps/worker/src/sendDigest.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateTestToken } from "./testUtils";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "x" }, error: null });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } }))
}));

import { sendDailyDigest } from "./sendDigest";

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("sendDailyDigest", () => {
  beforeEach(async () => {
    sendMock.mockClear();
    await prisma.digestSend.deleteMany({});
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
    process.env.FROM_EMAIL = "Gazete <onboarding@resend.dev>";
    process.env.BASE_URL = "http://localhost:3000";
  });

  it("sends to every active subscriber and records status=sent", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "a@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });

    await sendDailyDigest();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe("a@example.com");

    const record = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: sub.id, digestDate: today() } }
    });
    expect(record?.status).toBe("sent");
  });

  it("does not send to an unsubscribed subscriber", async () => {
    await prisma.subscriber.create({
      data: { email: "b@example.com", preferencesToken: generateTestToken(), status: "unsubscribed", categories: { create: [{ category: "gundem" }] } }
    });

    await sendDailyDigest();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("is idempotent: does not resend if today's DigestSend is already 'sent'", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "c@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });
    await prisma.digestSend.create({ data: { subscriberId: sub.id, digestDate: today(), status: "sent", sentAt: new Date() } });

    await sendDailyDigest();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("in dry-run mode, does not call the email API but still logs what would be sent", async () => {
    await prisma.subscriber.create({
      data: { email: "d@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });

    await sendDailyDigest({ dryRun: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("marks the DigestSend as failed if the send throws, without stopping other subscribers", async () => {
    sendMock.mockRejectedValueOnce(new Error("API down")).mockResolvedValueOnce({ data: { id: "x" }, error: null });

    const failing = await prisma.subscriber.create({
      data: { email: "fail@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });
    const okSub = await prisma.subscriber.create({
      data: { email: "ok@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });

    await sendDailyDigest();

    const failingRecord = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: failing.id, digestDate: today() } }
    });
    const okRecord = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: okSub.id, digestDate: today() } }
    });
    expect(failingRecord?.status).toBe("failed");
    expect(okRecord?.status).toBe("sent");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/worker/src/sendDigest.test.ts`
Expected: FAIL — `Cannot find module './sendDigest'`.

- [ ] **Step 3: Implement `apps/worker/src/sendDigest.ts`**

```typescript
import { Resend } from "resend";
import { prisma } from "@gazete/db";
import { getStoriesForSubscriber } from "./digestQuery";
import { renderDigestHtml } from "./renderDigest";
import { config } from "./config";

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function sendDailyDigest(options: { dryRun?: boolean } = {}): Promise<void> {
  const digestDate = today();
  const subscribers = await prisma.subscriber.findMany({ where: { status: "active" } });
  const resend = new Resend(config.resendApiKey);

  for (const subscriber of subscribers) {
    const existing = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } }
    });
    if (existing?.status === "sent") continue;

    const stories = await getStoriesForSubscriber(subscriber.id, digestDate);
    if (stories.length === 0) continue;

    const html = renderDigestHtml(stories, subscriber.preferencesToken, config.baseUrl);

    if (options.dryRun) {
      console.log(`[dry-run] would send to ${subscriber.email}: ${stories.length} stories`);
      continue;
    }

    try {
      await resend.emails.send({
        from: config.fromEmail,
        to: subscriber.email,
        subject: "Bugünkü Gazete'n hazır",
        html
      });
      await prisma.digestSend.upsert({
        where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } },
        create: { subscriberId: subscriber.id, digestDate, status: "sent", sentAt: new Date() },
        update: { status: "sent", sentAt: new Date() }
      });
    } catch (err) {
      console.error(`Digest send failed for ${subscriber.email}:`, err);
      await prisma.digestSend.upsert({
        where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } },
        create: { subscriberId: subscriber.id, digestDate, status: "failed" },
        update: { status: "failed" }
      });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/worker/src/sendDigest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/sendDigest.ts apps/worker/src/sendDigest.test.ts
git commit -m "feat(worker): send daily digest with idempotency and dry-run"
```

---

### Task 20: Worker entry point — cron wiring

**Files:**
- Create: `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: `fetchAllSources` (Task 14), `processNewArticles` (Task 16), `sendDailyDigest` (Task 19).
- Produces: the worker's process entry point, scheduling the hourly pipeline and the 08:45 digest send in `Europe/Istanbul`, and running a one-shot pass immediately when `--dry-run` is passed (so a human can preview output without waiting for the next cron tick).

- [ ] **Step 1: Implement `apps/worker/src/index.ts`**

```typescript
import cron from "node-cron";
import { config } from "./config";
import { fetchAllSources } from "./fetchRss";
import { processNewArticles } from "./processArticles";
import { sendDailyDigest } from "./sendDigest";

const isDryRun = process.argv.includes("--dry-run");

async function runFetchPipeline(): Promise<void> {
  const errors = await fetchAllSources();
  for (const error of errors) {
    console.error(`RSS fetch failed for ${error.sourceName} (${error.sourceId}): ${error.error}`);
  }
  await processNewArticles();
}

if (isDryRun) {
  runFetchPipeline()
    .then(() => sendDailyDigest({ dryRun: true }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  cron.schedule("0 * * * *", () => {
    runFetchPipeline().catch((err) => console.error("Fetch pipeline error:", err));
  }, { timezone: config.timezone });

  cron.schedule("45 8 * * *", () => {
    sendDailyDigest().catch((err) => console.error("Digest send error:", err));
  }, { timezone: config.timezone });

  console.log(`Gazete worker started. Timezone: ${config.timezone}`);
}
```

- [ ] **Step 2: Manually verify the dry run end-to-end**

Ensure `.env` has real `ANTHROPIC_API_KEY` and at least one active `Source` (Task 13) and one `Subscriber` (subscribe via the web app from Task 8) with a category matching a seeded source's category.

Run: `npm run dry-run --workspace=@gazete/worker`
Expected: console output showing RSS fetch, any per-source errors, then a `[dry-run] would send to ...` line for your own subscription — no real email sent, no crash.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/index.ts
git commit -m "feat(worker): wire cron schedule and dry-run entry point"
```

---

## Phase 5 — Deployment

### Task 21: Dockerfiles for web and worker

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/worker/Dockerfile`

**Interfaces:**
- Produces: buildable images for both apps, consumed by `docker-compose.yml` in Task 22.

- [ ] **Step 1: Create `apps/web/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run prisma:generate --workspace=@gazete/db
RUN npm run build --workspace=apps/web

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
```

Note: `npm ci` needs every workspace's `package.json` present to match `package-lock.json` (root `workspaces: ["apps/*", "packages/*"]` covers `apps/web`, `apps/worker`, and `packages/db`) — copying only this app's own `package.json` before `npm ci` leaves `apps/worker` missing from the build context and `npm ci` fails. `COPY . .` before `npm ci` avoids that at the cost of Docker layer-caching granularity, which is an acceptable tradeoff at this project's size.

- [ ] **Step 2: Create `apps/worker/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run prisma:generate --workspace=@gazete/db

CMD ["npm", "run", "start", "--workspace=@gazete/worker"]
```

Note: same reasoning as `apps/web/Dockerfile` — `npm ci` needs every workspace's `package.json` present, so `COPY . .` runs before it rather than copying a subset of package.json files.

- [ ] **Step 3: Verify each image builds**

Run: `docker build -f apps/web/Dockerfile -t gazete-web .`
Run: `docker build -f apps/worker/Dockerfile -t gazete-worker .`
Expected: both builds complete without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/Dockerfile apps/worker/Dockerfile
git commit -m "chore: add production Dockerfiles for web and worker"
```

---

### Task 22: Docker Compose + Caddy for the VPS

**Files:**
- Create: `docker-compose.yml`
- Create: `Caddyfile`
- Create: `DEPLOY.md`

**Interfaces:**
- Produces: the full production stack (`postgres`, `web`, `worker`, `caddy`) runnable on the VPS with `docker compose up -d`.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gazete
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: gazete
    volumes:
      - gazete_pg_data:/var/lib/postgresql/data
    restart: unless-stopped

  migrate:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    command: ["npm", "run", "prisma:deploy", "--workspace=@gazete/db"]
    environment:
      DATABASE_URL: postgresql://gazete:${POSTGRES_PASSWORD}@postgres:5432/gazete
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      DATABASE_URL: postgresql://gazete:${POSTGRES_PASSWORD}@postgres:5432/gazete
      RESEND_API_KEY: ${RESEND_API_KEY}
      RESEND_WEBHOOK_SECRET: ${RESEND_WEBHOOK_SECRET}
      FROM_EMAIL: ${FROM_EMAIL}
      BASE_URL: ${BASE_URL}
    depends_on:
      - migrate
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://gazete:${POSTGRES_PASSWORD}@postgres:5432/gazete
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      RESEND_API_KEY: ${RESEND_API_KEY}
      FROM_EMAIL: ${FROM_EMAIL}
      BASE_URL: ${BASE_URL}
    depends_on:
      - migrate
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - gazete_caddy_data:/data
    depends_on:
      - web
    restart: unless-stopped

volumes:
  gazete_pg_data:
  gazete_caddy_data:
```

- [ ] **Step 2: Create `Caddyfile`**

The project owns two real domains: `turkiyeningazetesi.com` (primary) and `turkiyeningazetesi.org` (redirects to `.com`). Caddy auto-provisions a TLS certificate for each domain listed, as long as its DNS A record already points at this VPS's IP before Caddy starts (see `DEPLOY.md`'s DNS step).

```
turkiyeningazetesi.com, www.turkiyeningazetesi.com {
  reverse_proxy web:3000
}

turkiyeningazetesi.org, www.turkiyeningazetesi.org {
  redir https://turkiyeningazetesi.com{uri} permanent
}
```

- [ ] **Step 3: Create `DEPLOY.md`**

```markdown
# Deploy

## 1. Point DNS at the VPS (do this first — certificates depend on it)

At your domain registrar/DNS provider, create these A records, all pointing at the VPS's public IP:

- `turkiyeningazetesi.com` → VPS IP
- `www.turkiyeningazetesi.com` → VPS IP
- `turkiyeningazetesi.org` → VPS IP
- `www.turkiyeningazetesi.org` → VPS IP

DNS propagation can take anywhere from a few minutes to a few hours. Verify with `dig turkiyeningazetesi.com +short` (or `nslookup` on Windows) before continuing — it should print the VPS's IP.

## 2. First-time VPS setup

1. Install Docker + the Docker Compose plugin on the VPS.
2. Clone this repo onto the VPS (e.g. into `/opt/gazete`).
3. Create a `.env` file there (not committed) with: `POSTGRES_PASSWORD`, `RESEND_API_KEY`,
   `RESEND_WEBHOOK_SECRET`, `FROM_EMAIL=info@turkiyeningazetesi.com`, `ANTHROPIC_API_KEY`, `BASE_URL=https://turkiyeningazetesi.com`.
   `RESEND_API_KEY` requires verifying `turkiyeningazetesi.com` as a sending domain in the Resend dashboard first (it will ask you to add its own DNS TXT/CNAME records, separate from the A records above).
4. Seed the RSS sources once: `docker compose run --rm migrate npx prisma db seed --schema=packages/db/prisma/schema.prisma`
5. Start everything: `docker compose up -d --build`
6. Check logs: `docker compose logs -f worker`
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml Caddyfile DEPLOY.md
git commit -m "chore: add Docker Compose and Caddy deployment config"
```

---

### Task 23: GitLab CI/CD pipeline for automated VPS deploy

**Files:**
- Create: `.gitlab-ci.yml`
- Modify: `DEPLOY.md` (append a GitLab CI/CD setup section)

**Interfaces:**
- Produces: a GitLab CI pipeline that, on every push to `main`, SSHes into the VPS and re-deploys via `docker compose up -d --build`.

This task only creates the pipeline definition and documents the manual GitLab/VPS setup steps — it cannot itself create a GitLab project, generate SSH keys, or add CI/CD variables, since those require the user's own GitLab account and VPS access, none of which are available to an implementer working in this repo checkout.

- [ ] **Step 1: Create `.gitlab-ci.yml`**

```yaml
stages:
  - deploy

deploy:
  stage: deploy
  image: alpine:latest
  only:
    - main
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$VPS_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan -H "$VPS_HOST" >> ~/.ssh/known_hosts
  script:
    - ssh "$VPS_USER@$VPS_HOST" "cd /opt/gazete && git pull origin main && docker compose up -d --build"
```

- [ ] **Step 2: Append a GitLab setup section to `DEPLOY.md`**

Add this section to the end of the `DEPLOY.md` file created in Task 22:

```markdown

## 3. GitLab CI/CD (automated deploy on push)

This repo's source of truth stays on GitHub. GitLab is used only for its CI/CD runner, via a pull mirror:

1. Create a new GitLab project (empty, no README).
2. In the GitLab project's **Settings → Repository → Mirroring repositories**, add this repo's GitHub HTTPS URL as a **pull mirror** (GitLab periodically pulls new commits from GitHub — no change needed to how you push to GitHub).
3. On the VPS, create a dedicated deploy user (or reuse an existing one) and generate an SSH key pair for it: `ssh-keygen -t ed25519 -C "gitlab-deploy" -f ~/.ssh/gitlab_deploy` (no passphrase, since CI runs non-interactively).
4. Add the **public** key (`~/.ssh/gitlab_deploy.pub`) to that VPS user's `~/.ssh/authorized_keys`.
5. In the GitLab project's **Settings → CI/CD → Variables**, add three variables, all marked **Protected** and **Masked** (except `VPS_HOST`, which isn't secret):
   - `VPS_SSH_PRIVATE_KEY` — the contents of the **private** key file (`~/.ssh/gitlab_deploy`)
   - `VPS_HOST` — the VPS's IP or `turkiyeningazetesi.com`
   - `VPS_USER` — the deploy user's username
6. Make sure `/opt/gazete` on the VPS is a clone of this repo with `origin` pointing at GitHub (`git remote -v` to check), so `git pull origin main` in the pipeline has something to pull from.
7. Push to GitHub's `main` branch; once GitLab's mirror picks up the new commit (mirroring runs on an interval — check **Repository → Mirroring** for "Update now" to trigger it immediately while testing), the pipeline runs automatically and re-deploys.
```

- [ ] **Step 3: Commit**

```bash
git add .gitlab-ci.yml DEPLOY.md
git commit -m "chore: add GitLab CI/CD pipeline for automated VPS deploy"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Tasks 1, 12, 21-22), data model (Task 3), RSS fetch/dedupe/categorize (Tasks 13-16), AI Turkish summaries (Task 16), daily 09:00-window digest with source links (Tasks 17-20 — send runs at 08:45 so delivery lands by 09:00), friction-free active-on-signup subscription with bounce-based cleanup (Tasks 6, 7, 11), preferences update (Task 9), one-click unsubscribe (Task 10), dev-only sender email note (Global Constraints + `.env.example`) — all covered.
- **Type consistency checked:** `preferencesToken` name is consistent across Tasks 3/4/7/9/10/17/19; `Category` enum values (`gundem`, `ekonomi`, `teknoloji`, `spor`, `dunya`, `saglik`, `kultur_sanat`) are consistent across schema, seed, template, and tests; `StoryWithSources` shape defined once in Task 17 and imported (not redefined) in Tasks 18-19.
- **No placeholders:** every task has runnable code; scaffold-only steps (Next.js init, `npm install`) are shell commands rather than hand-typed boilerplate, which is intentional, not a placeholder.
