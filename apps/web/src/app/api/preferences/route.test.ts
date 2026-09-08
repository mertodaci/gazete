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
