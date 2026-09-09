import cron from "node-cron";
import { config } from "./config";
import { fetchAllSources } from "./fetchRss";
import { processNewArticles } from "./processArticles";
import { sendDailyDigest } from "./sendDigest";

const isDryRun = process.argv.includes("--dry-run");

async function runFetchPipeline(): Promise<void> {
  const errors = await fetchAllSources();
  for (const error of errors) {
    console.error(`RSS fetch failed for ${error.sourceName} (${error.sourceId}): ${error.error}`);
  }
  await processNewArticles();
}

if (isDryRun) {
  runFetchPipeline()
    .then(() => sendDailyDigest({ dryRun: true }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  cron.schedule("0 * * * *", () => {
    runFetchPipeline().catch((err) => console.error("Fetch pipeline error:", err));
  }, { timezone: config.timezone });

  cron.schedule("45 8 * * *", () => {
    sendDailyDigest().catch((err) => console.error("Digest send error:", err));
  }, { timezone: config.timezone });

  // Retry pass for anyone whose 08:45 send failed (or crashed mid-send).
  // sendDailyDigest already skips subscribers whose DigestSend is "sent", so
  // re-running it only picks up "failed"/"pending" rows and anyone missed.
  cron.schedule("0 9 * * *", () => {
    sendDailyDigest().catch((err) => console.error("Digest retry error:", err));
  }, { timezone: config.timezone });

  console.log(`Gazete worker started. Timezone: ${config.timezone}`);
}
