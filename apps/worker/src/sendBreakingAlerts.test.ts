import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateTestToken } from "./testUtils";
import { istanbulToday } from "./istanbulDate";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "x" }, error: null });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } }))
}));

import { sendBreakingAlerts } from "./sendBreakingAlerts";

const today = istanbulToday;

async function makeBreakingStory(title = "Büyük Sonuç") {
  return prisma.story.create({
    data: {
      category: "spor",
      canonicalTitle: title,
      aiSummaryTr: "Özet.",
      isBreaking: true,
      digestDate: today()
    }
  });
}

describe("sendBreakingAlerts", () => {
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

  it("sends one alert to every son_dakika subscriber and marks the story alerted", async () => {
    await prisma.subscriber.create({
      data: { email: "alert@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    const story = await makeBreakingStory();

    await sendBreakingAlerts();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe("alert@example.com");

    const updated = await prisma.story.findUnique({ where: { id: story.id } });
    expect(updated?.breakingAlertSentAt).not.toBeNull();
  });

  it("sends nothing when there are no unalerted breaking stories", async () => {
    await prisma.subscriber.create({
      data: { email: "nobody@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });

    await sendBreakingAlerts();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not re-alert a story that was already alerted", async () => {
    await prisma.subscriber.create({
      data: { email: "again@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    const story = await makeBreakingStory();
    await prisma.story.update({ where: { id: story.id }, data: { breakingAlertSentAt: new Date() } });

    await sendBreakingAlerts();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not email a subscriber who has not selected son_dakika", async () => {
    await prisma.subscriber.create({
      data: { email: "topic-only@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "spor" }] } }
    });
    await makeBreakingStory();

    await sendBreakingAlerts();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("in dry-run mode, does not call the email API and does not mark the story alerted", async () => {
    await prisma.subscriber.create({
      data: { email: "dry@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    const story = await makeBreakingStory();

    await sendBreakingAlerts({ dryRun: true });

    expect(sendMock).not.toHaveBeenCalled();
    const updated = await prisma.story.findUnique({ where: { id: story.id } });
    expect(updated?.breakingAlertSentAt).toBeNull();
  });
});
