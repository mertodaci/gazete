import { describe, expect, it, beforeEach } from "vitest";
import { Webhook } from "svix";
import { prisma } from "@gazete/db";
import { generateToken } from "@/lib/token";

import { POST } from "./route";

// svix is deliberately NOT mocked: signature verification is the only auth
// control on this public, state-mutating endpoint, so the tests exercise the
// real verifier. svix's own Webhook.sign() produces the valid signatures.
const SECRET = "whsec_" + Buffer.from("gazete-test-webhook-secret-0123").toString("base64");

function makeRequest(payload: string, signature?: string): Request {
  const msgId = "msg_test";
  const timestamp = new Date();
  const realSignature = new Webhook(SECRET).sign(msgId, timestamp, payload);
  return new Request("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": msgId,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature ?? realSignature
    },
    body: payload
  });
}

function bouncePayload(email: string, bounceType?: string): string {
  return JSON.stringify({
    type: "email.bounced",
    data: {
      to: [email],
      ...(bounceType ? { bounce: { type: bounceType, subType: "General" } } : {})
    }
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(async () => {
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
  });

  it("rejects a request whose signature does not match the configured secret", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "tampered@example.com", preferencesToken: generateToken() }
    });

    const res = await POST(makeRequest(bouncePayload("tampered@example.com", "Permanent"), "v1,dGFtcGVyZWQtc2lnbmF0dXJl"));
    expect(res.status).toBe(400);

    const unchanged = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(unchanged?.status).toBe("active");
  });

  it("rejects a payload that was modified after being signed", async () => {
    const signed = bouncePayload("original@example.com", "Permanent");
    const wh = new Webhook(SECRET);
    const msgId = "msg_test";
    const timestamp = new Date();
    const signature = wh.sign(msgId, timestamp, signed);

    const res = await POST(
      new Request("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": msgId,
          "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
          "svix-signature": signature
        },
        body: bouncePayload("attacker@example.com", "Permanent")
      })
    );
    expect(res.status).toBe(400);
  });

  it("unsubscribes the matching subscriber on a permanent email.bounced", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "bounced@example.com", preferencesToken: generateToken() }
    });

    const res = await POST(makeRequest(bouncePayload("bounced@example.com", "Permanent")));
    expect(res.status).toBe(200);

    const updated = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(updated?.status).toBe("unsubscribed");
  });

  it("does not unsubscribe on a transient bounce (full mailbox, greylisting, ...)", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "soft@example.com", preferencesToken: generateToken() }
    });

    const res = await POST(makeRequest(bouncePayload("soft@example.com", "Transient")));
    expect(res.status).toBe(200);

    const unchanged = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(unchanged?.status).toBe("active");
  });

  it("does not unsubscribe when the bounce type is missing or unrecognised", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "unknown@example.com", preferencesToken: generateToken() }
    });

    const res = await POST(makeRequest(bouncePayload("unknown@example.com")));
    expect(res.status).toBe(200);

    const unchanged = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(unchanged?.status).toBe("active");
  });

  it("ignores unrelated event types", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "delivered@example.com", preferencesToken: generateToken() }
    });

    await POST(makeRequest(JSON.stringify({ type: "email.delivered", data: { to: ["delivered@example.com"] } })));

    const unchanged = await prisma.subscriber.findUnique({ where: { id: sub.id } });
    expect(unchanged?.status).toBe("active");
  });
});
