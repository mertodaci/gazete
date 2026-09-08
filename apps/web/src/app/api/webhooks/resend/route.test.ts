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
