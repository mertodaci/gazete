import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateToken } from "@/lib/token";
// Avoids real Anthropic/Voyage calls in tests — see subscribe/route.test.ts
// for the same rationale.
vi.mock("@/lib/interest", () => ({
  processInterestText: vi.fn().mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: false })
}));
import { GET, POST } from "./route";
import { processInterestText } from "@/lib/interest";

async function makeSubscriber(categories: string[] = ["gundem"], status: "active" | "unsubscribed" = "active") {
  const token = generateToken();
  const sub = await prisma.subscriber.create({
    data: {
      email: `pref-${Date.now()}-${Math.random()}@example.com`,
      preferencesToken: token,
      status,
      categories: { create: categories.map((category) => ({ category: category as any })) }
    }
  });
  return { sub, token };
}

describe("GET /api/preferences", () => {
  beforeEach(async () => {
    // digestSend must go first — it has a FK on subscriber, and other test
    // files (sendDigest.test.ts) can leave rows here from a real (non-dry-run)
    // send whose subscriber this file's own cleanup would otherwise conflict
    // with when deleting subscribers below.
    await prisma.digestSend.deleteMany({});
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

  it("includes the subscriber's status", async () => {
    const { token } = await makeSubscriber(["ekonomi"], "unsubscribed");
    const res = await GET(new Request(`http://localhost:3000/api/preferences?token=${token}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("unsubscribed");
  });

  it("includes the subscriber's interestText", async () => {
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    await prisma.subscriber.update({ where: { id: sub.id }, data: { interestText: "deprem, yapay zeka" } });
    const res = await GET(new Request(`http://localhost:3000/api/preferences?token=${token}`));
    const json = await res.json();
    expect(json.interestText).toBe("deprem, yapay zeka");
  });
});

describe("POST /api/preferences", () => {
  beforeEach(async () => {
    vi.mocked(processInterestText).mockClear();
    vi.mocked(processInterestText).mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: false });
    await prisma.digestSend.deleteMany({});
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
        body: JSON.stringify({ token: "doesnotexist", categories: ["ekonomi"] })
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects 'gundem' with 400 — it's an internal fallback, never a real subscriber selection", async () => {
    const { token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["gundem"] })
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts 'son_dakika' as a selectable category", async () => {
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["son_dakika"] })
      })
    );
    expect(res.status).toBe(200);
    const updated = await prisma.subscriberCategory.findMany({ where: { subscriberId: sub.id } });
    expect(updated.map((c) => c.category)).toEqual(["son_dakika"]);
  });

  it("rejects a save for an unsubscribed account with 409, leaving categories untouched", async () => {
    const { sub, token } = await makeSubscriber(["ekonomi"], "unsubscribed");
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["teknoloji"] })
      })
    );
    expect(res.status).toBe(409);

    const unchanged = await prisma.subscriberCategory.findMany({ where: { subscriberId: sub.id } });
    expect(unchanged.map((c) => c.category)).toEqual(["ekonomi"]);
  });

  it("stores a moderated interest text and its embedding", async () => {
    vi.mocked(processInterestText).mockResolvedValue({
      interestText: "deprem, yapay zeka",
      interestEmbedding: [0.1, 0.2],
      rejected: false
    });
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["ekonomi"], interestText: "deprem, yapay zeka" })
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.interestRejected).toBe(false);

    const updated = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(updated?.interestText).toBe("deprem, yapay zeka");
    expect(updated?.interestEmbedding).toEqual([0.1, 0.2]);
  });

  it("still saves categories when the interest text is rejected, and reports interestRejected", async () => {
    vi.mocked(processInterestText).mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: true });
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: ["spor"], interestText: "kötüye kullanım denemesi" })
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.interestRejected).toBe(true);

    const updated = await prisma.subscriber.findUnique({
      where: { id: sub.id },
      include: { categories: true }
    });
    expect(updated?.interestText).toBeNull();
    expect(updated?.categories.map((c) => c.category)).toEqual(["spor"]);
  });

  it("saves an empty category list when the interest text alone is provided and accepted", async () => {
    vi.mocked(processInterestText).mockResolvedValue({
      interestText: "deprem, yapay zeka",
      interestEmbedding: [0.1, 0.2],
      rejected: false
    });
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: [], interestText: "deprem, yapay zeka" })
      })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.subscriber.findUnique({
      where: { id: sub.id },
      include: { categories: true }
    });
    expect(updated?.categories).toEqual([]);
    expect(updated?.interestText).toBe("deprem, yapay zeka");
  });

  it("rejects with 400 when both categories and interest text are missing", async () => {
    const { token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: [] })
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects with 400 when categories is empty and the interest text fails moderation", async () => {
    vi.mocked(processInterestText).mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: true });
    const { sub, token } = await makeSubscriber(["ekonomi"]);
    const res = await POST(
      new Request("http://localhost:3000/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, categories: [], interestText: "kötüye kullanım denemesi" })
      })
    );
    expect(res.status).toBe(400);

    // Nothing changed — the previous categories are still intact.
    const unchanged = await prisma.subscriberCategory.findMany({ where: { subscriberId: sub.id } });
    expect(unchanged.map((c) => c.category)).toEqual(["ekonomi"]);
  });
});
