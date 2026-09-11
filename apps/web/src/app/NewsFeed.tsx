"use client";

import { useState } from "react";
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

// A busy category (ekonomi, spor) can carry dozens of stories on an active
// day — showing all of them at once is what made the homepage feel like an
// unbroken wall of text. Six gives a real front-page glance per section
// without hiding anything permanently (readers can still expand).
const INITIAL_VISIBLE = 6;

function CategorySection({ category, items }: { category: string; items: PublicStory[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div className={styles.section} id={`kategori-${category}`}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{CATEGORY_LABELS[category] ?? category}</h3>
        <span className={styles.sectionCount}>{items.length} haber</span>
      </div>

      <div className={styles.grid}>
        {visible.map((story) => (
          <article className={styles.story} key={story.id}>
            <h4 className={styles.storyTitle}>{story.canonicalTitle}</h4>
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

      {hiddenCount > 0 && (
        <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
          Daha fazla göster ({hiddenCount})
        </button>
      )}
    </div>
  );
}

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

      <nav className={styles.categoryNav} aria-label="Kategoriler">
        {byCategory.map(({ category }) => (
          <a key={category} href={`#kategori-${category}`} className={styles.categoryLink}>
            {CATEGORY_LABELS[category] ?? category}
          </a>
        ))}
      </nav>

      {byCategory.map(({ category, items }) => (
        <CategorySection key={category} category={category} items={items} />
      ))}
    </section>
  );
}
