import { Resend } from "resend";
import { prisma } from "@gazete/db";
import { getStoriesForSubscriber } from "./digestQuery";
import { renderDigestHtml } from "./renderDigest";
import { istanbulToday } from "./istanbulDate";
import { config } from "./config";

export async function sendDailyDigest(options: { dryRun?: boolean } = {}): Promise<void> {
  const digestDate = istanbulToday();
  const subscribers = await prisma.subscriber.findMany({ where: { status: "active" } });
  const resend = new Resend(config.resendApiKey);

  for (const subscriber of subscribers) {
    const existing = await prisma.digestSend.findUnique({
      where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } }
    });
    if (existing?.status === "sent") continue;

    const stories = await getStoriesForSubscriber(subscriber.id, digestDate);
    if (stories.length === 0) continue;

    const html = renderDigestHtml(stories, subscriber.preferencesToken, config.baseUrl, digestDate);

    if (options.dryRun) {
      console.log(`[dry-run] would send to ${subscriber.email}: ${stories.length} stories`);
      continue;
    }

    // Mark the attempt as pending *before* calling the email API, so a crash
    // mid-send leaves an accurate record rather than nothing at all.
    await prisma.digestSend.upsert({
      where: { subscriberId_digestDate: { subscriberId: subscriber.id, digestDate } },
      create: { subscriberId: subscriber.id, digestDate, status: "pending" },
      update: { status: "pending" }
    });

    const unsubscribeUrl = `${config.baseUrl}/unsubscribe?token=${subscriber.preferencesToken}`;

    try {
      await resend.emails.send({
        from: config.fromEmail,
        to: subscriber.email,
        subject: "Bugünkü Gazete'n hazır",
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
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
