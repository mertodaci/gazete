import styles from "./page.module.css";
import { SubscribeForm } from "./SubscribeForm";
import { NewsFeed } from "./NewsFeed";
import { getTodaysStories } from "../lib/publicStories";

// This page queries the database directly (today's stories), so it must
// render per-request, not be statically prerendered at `next build` time —
// no database is reachable yet during the Docker image build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await getTodaysStories();

  return (
    <main className={styles.page}>
      <p className={styles.wordmark}>Türkiye&apos;nin Gazetesi</p>
      <h1 className={styles.headline}>
        Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük haber bülteni.
      </h1>
      <p className={styles.subtext}>
        Gazete&apos;ye ücretsiz abone ol, her sabah 09.00&apos;da kutunda olsun.
      </p>
      <SubscribeForm />
      <NewsFeed stories={stories} />
    </main>
  );
}
