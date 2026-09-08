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

async function makeStoryForToday(category: "gundem" | "spor" = "gundem") {
  const source = await prisma.source.create({
    data: { name: "Test Kaynak", rssUrl: `https://example.com/rss-${Date.now()}-${Math.random()}`, category }
  });
  const article = await prisma.article.create({
    data: { sourceId: source.id, url: `https://example.com/a-${Date.now()}-${Math.random()}`, title: "Test Haberi", publishedAt: new Date() }
  });
  return prisma.story.create({
    data: {
      category,
      canonicalTitle: "Test Haberi",
      aiSummaryTr: "Test özeti.",
      digestDate: today(),
      storyArticles: { create: { articleId: article.id } }
    }
  });
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
    await makeStoryForToday();

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
    await makeStoryForToday();

    await sendDailyDigest();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("is idempotent: does not resend if today's DigestSend is already 'sent'", async () => {
    const sub = await prisma.subscriber.create({
      data: { email: "c@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });
    await makeStoryForToday();
    await prisma.digestSend.create({ data: { subscriberId: sub.id, digestDate: today(), status: "sent", sentAt: new Date() } });

    await sendDailyDigest();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("in dry-run mode, does not call the email API but still logs what would be sent", async () => {
    await prisma.subscriber.create({
      data: { email: "d@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "gundem" }] } }
    });
    await makeStoryForToday();

    await sendDailyDigest({ dryRun: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("marks the DigestSend as failed if the send throws, without stopping other subscribers", async () => {
    sendMock.mockRejectedValueOnce(new Error("API down")).mockResolvedValueOnce({ data: { id: "x" }, error: null });
    await makeStoryForToday();

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

  it("does not send and does not create a DigestSend row when the subscriber has no matching stories that day", async () => {
    await prisma.subscriber.create({
      data: { email: "empty@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "spor" }] } }
    });
    // Only a "gundem" story exists today; this subscriber only follows "spor", so
    // getStoriesForSubscriber returns [] and the digest must be skipped entirely.
    await makeStoryForToday("gundem");

    await sendDailyDigest();

    expect(sendMock).not.toHaveBeenCalled();
    const records = await prisma.digestSend.findMany({});
    expect(records).toHaveLength(0);
  });
});
