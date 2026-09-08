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
