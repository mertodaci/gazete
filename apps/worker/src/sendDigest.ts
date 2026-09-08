import { Resend } from "resend";
import { prisma } from "@gazete/db";
import { getStoriesForSubscriber } from "./digestQuery";
import { renderDigestHtml } from "./renderDigest";
import { config } from "./config";

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function sendDailyDigest(options: { dryRun?: boolean } = {}): Promise<void> {
  const digestDate = today();
  const subscribers = await prisma.subscriber.findMany({ where: { status: "active" } });
  const resend = new Resend(config.resendApiKey);

  for (const subscriber of subscribers) {
    const existing = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } }
    });
    if (existing?.status === "sent") continue;

    const stories = await getStoriesForSubscriber(subscriber.id, digestDate);
    if (stories.length === 0) continue;

    const html = renderDigestHtml(stories, subscriber.preferencesToken, config.baseUrl);

    if (options.dryRun) {
      console.log(`[dry-run] would send to ${subscriber.email}: ${stories.length} stories`);
      continue;
    }

    try {
      await resend.emails.send({
        from: config.fromEmail,
        to: subscriber.email,
        subject: "Bugünkü Gazete'n hazır",
        html
      });
      await prisma.digestSend.upsert({
        where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } },
        create: { subscriberId: subscriber.id, digestDate, status: "sent", sentAt: new Date() },
        update: { status: "sent", sentAt: new Date() }
      });
    } catch (err) {
      console.error(`Digest send failed for ${subscriber.email}:`, err);
      await prisma.digestSend.upsert({
        where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } },
        create: { subscriberId: subscriber.id, digestDate, status: "failed" },
        update: { status: "failed" }
      });
    }
  }
}
