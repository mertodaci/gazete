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
