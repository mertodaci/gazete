import type { PublicStory } from "../lib/publicStories";
import styles from "./NewsFeed.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  gundem: "Gündem",
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

const CATEGORY_ORDER = ["gundem", "ekonomi", "teknoloji", "spor", "dunya", "saglik", "kultur_sanat"];

export function NewsFeed({ stories }: { stories: PublicStory[] }) {
  if (stories.length === 0) {
    return (
      <section className={styles.feed}>
        <h2 className={styles.feedTitle}>Bugünün haberleri</h2>
        <p className={styles.empty}>
          Bugün için özetlenmiş haber henüz yok — yapay zekâ üzerinde çalışıyor, birazdan burada olacak.
        </p>
      </section>
    );
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: stories.filter((s) => s.category === category)
  })).filter((group) => group.items.length > 0);

  return (
    <section className={styles.feed}>
      <h2 className={styles.feedTitle}>Bugünün haberleri</h2>
      {byCategory.map(({ category, items }) => (
        <div className={styles.group} key={category}>
          <span className={styles.groupTitle}>{CATEGORY_LABELS[category] ?? category}</span>
          {items.map((story) => (
            <article className={styles.story} key={story.id}>
              <p className={styles.summary}>{story.aiSummaryTr}</p>
              {story.sources.length > 0 && (
                <p className={styles.sources}>
                  Kaynak:{" "}
                  {story.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ", "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.name}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
