import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }));
// Avoids real Anthropic/Voyage calls in tests — deterministic, and no test
// here needs to exercise the real moderation/embedding logic (that's
// covered by apps/web/src/lib/interest.test.ts).
vi.mock("@/lib/interest", () => ({
  processInterestText: vi.fn().mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: false })
}));

import { POST } from "./route";
import { sendWelcomeEmail } from "@/lib/email";
import { processInterestText } from "@/lib/interest";

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
    vi.mocked(processInterestText).mockClear();
    vi.mocked(processInterestText).mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: false });
    // digestSend must go first — it has a FK on subscriber, and other test
    // files (sendDigest.test.ts) can leave rows here from a real (non-dry-run)
    // send whose subscriber this file's own cleanup would otherwise conflict
    // with when deleting subscribers below.
    await prisma.digestSend.deleteMany({});
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
    await POST(makeRequest({ email: "repeat@example.com", categories: ["ekonomi"] }, "3.3.3.3"));
    vi.mocked(sendWelcomeEmail).mockClear();

    const res = await POST(makeRequest({ email: "repeat@example.com", categories: ["teknoloji"] }, "4.4.4.4"));
    expect(res.status).toBe(201);

    const subs = await prisma.subscriber.findMany({ where: { email: "repeat@example.com" } });
    expect(subs).toHaveLength(1);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("reactivates a previously unsubscribed address when they subscribe again", async () => {
    await prisma.subscriber.create({
      data: {
        email: "returning@example.com",
        preferencesToken: "reactivate-test-token",
        status: "unsubscribed",
        categories: { create: [{ category: "gundem" }] }
      }
    });

    const res = await POST(makeRequest({ email: "returning@example.com", categories: ["spor"] }, "9.9.9.9"));
    expect(res.status).toBe(201);

    const sub = await prisma.subscriber.findUnique({
      where: { email: "returning@example.com" },
      include: { categories: true }
    });
    expect(sub?.status).toBe("active");
    expect(sub?.categories.map((c) => c.category)).toEqual(["spor"]);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", categories: ["gundem"] }, "5.5.5.5"));
    expect(res.status).toBe(400);
  });

  it("rejects an empty categories list with 400", async () => {
    const res = await POST(makeRequest({ email: "valid@example.com", categories: [] }, "6.6.6.6"));
    expect(res.status).toBe(400);
  });

  it("rejects 'gundem' with 400 — it's an internal fallback, never a real subscriber selection", async () => {
    const res = await POST(makeRequest({ email: "gundem@example.com", categories: ["gundem"] }, "10.10.10.10"));
    expect(res.status).toBe(400);
    const sub = await prisma.subscriber.findUnique({ where: { email: "gundem@example.com" } });
    expect(sub).toBeNull();
  });

  it("accepts 'son_dakika' as a selectable category", async () => {
    const res = await POST(makeRequest({ email: "breaking@example.com", categories: ["son_dakika"] }, "11.11.11.11"));
    expect(res.status).toBe(201);
    const sub = await prisma.subscriber.findUnique({
      where: { email: "breaking@example.com" },
      include: { categories: true }
    });
    expect(sub?.categories.map((c) => c.category)).toEqual(["son_dakika"]);
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

  it("stores a moderated interest text and its embedding", async () => {
    vi.mocked(processInterestText).mockResolvedValue({
      interestText: "deprem, yapay zeka",
      interestEmbedding: [0.1, 0.2, 0.3],
      rejected: false
    });
    const res = await POST(
      makeRequest(
        { email: "interested@example.com", categories: ["ekonomi"], interestText: "deprem, yapay zeka" },
        "12.12.12.12"
      )
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.interestRejected).toBe(false);

    const sub = await prisma.subscriber.findUnique({ where: { email: "interested@example.com" } });
    expect(sub?.interestText).toBe("deprem, yapay zeka");
    expect(sub?.interestEmbedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("still saves categories when the interest text is rejected, and reports interestRejected", async () => {
    vi.mocked(processInterestText).mockResolvedValue({ interestText: null, interestEmbedding: [], rejected: true });
    const res = await POST(
      makeRequest(
        { email: "rejected@example.com", categories: ["spor"], interestText: "kötüye kullanım denemesi" },
        "13.13.13.13"
      )
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.interestRejected).toBe(true);

    const sub = await prisma.subscriber.findUnique({
      where: { email: "rejected@example.com" },
      include: { categories: true }
    });
    expect(sub?.interestText).toBeNull();
    expect(sub?.categories.map((c) => c.category)).toEqual(["spor"]);
  });
});
