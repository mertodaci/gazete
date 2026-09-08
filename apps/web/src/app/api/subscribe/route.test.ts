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
