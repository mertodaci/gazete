import { Resend } from "resend";
import { prisma, Category, MAX_BREAKING_STORIES } from "@gazete/db";
import { istanbulToday } from "./istanbulDate";
import { config } from "./config";
import { escapeHtml, renderSourceLink } from "./renderDigest";

interface AlertStory {
  canonicalTitle: string;
  aiSummaryTr: string;
  sources: { name: string; url: string }[];
}

function renderAlertHtml(stories: AlertStory[], baseUrl: string): string {
  const storiesHtml = stories
    .map(
      (story) => `
        <div style="margin:0 0 18px;">
          <p style="margin:0 0 4px;font-weight:700;">${escapeHtml(story.canonicalTitle)}</p>
          <p style="margin:0 0 6px;">${escapeHtml(story.aiSummaryTr)}</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5b6472;">${story.sources
            .map(renderSourceLink)
            .join(" &middot; ")}</p>
        </div>
      `
    )
    .join("");

  return `
    <html>
      <body style="margin:0;padding:0;background:#edeff2;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edeff2;">
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;">
                <tr>
                  <td style="padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#1b2430;">
                    <p style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#c9862c;">SON DAKİKA</p>
                    ${storiesHtml}
                    <p style="margin:8px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;">
                      <a href="${baseUrl}#son-dakika" style="color:#4a3311;font-weight:600;">Sitede gör</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Sends a short, near-real-time alert to "son_dakika" subscribers whenever
 * the hourly fetch cycle just classified a new breaking story — rather than
 * waiting for the next daily digest, which would make "son dakika" meaningless.
 * Only fires when there's genuinely something new (bounded by
 * `breakingAlertSentAt` — each story is alerted at most once), so most hourly
 * runs send nothing at all. The same story still appears in the next daily
 * digest's Son Dakika section as a recap, independent of this alert.
 */
export async function sendBreakingAlerts(options: { dryRun?: boolean } = {}): Promise<void> {
  const digestDate = istanbulToday();

  const unalerted = await prisma.story.findMany({
    where: { isBreaking: true, breakingAlertSentAt: null, digestDate, aiSummaryTr: { not: null } },
    include: { storyArticles: { include: { article: { include: { source: true } } } } },
    orderBy: { createdAt: "desc" },
    take: MAX_BREAKING_STORIES
  });

  if (unalerted.length === 0) return;

  const alertStories: AlertStory[] = unalerted.map((story) => ({
    canonicalTitle: story.canonicalTitle,
    aiSummaryTr: story.aiSummaryTr as string,
    sources: story.storyArticles.map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
  }));

  const subject =
    alertStories.length === 1
      ? `Son Dakika: ${alertStories[0].canonicalTitle}`
      : `${alertStories.length} son dakika haberi`;

  const subscribers = await prisma.subscriber.findMany({
    where: { status: "active", categories: { some: { category: Category.son_dakika } } }
  });

  if (options.dryRun) {
    console.log(`[dry-run] would send breaking alert "${subject}" to ${subscribers.length} subscriber(s)`);
    return;
  }

  const html = renderAlertHtml(alertStories, config.baseUrl);
  const resend = new Resend(config.resendApiKey);

  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${config.baseUrl}/unsubscribe?token=${subscriber.preferencesToken}`;
    try {
      await resend.emails.send({
        from: config.fromEmail,
        to: subscriber.email,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
      });
    } catch (err) {
      console.error(`Breaking alert send failed for ${subscriber.email}:`, err);
    }
  }

  // Mark alerted regardless of individual per-subscriber send failures above —
  // a story-level "already alerted" flag, not per-subscriber tracking, is an
  // intentional simplification given the current tiny subscriber count (see
  // implementation plan §7a).
  await prisma.story.updateMany({
    where: { id: { in: unalerted.map((story) => story.id) } },
    data: { breakingAlertSentAt: new Date() }
  });
}
