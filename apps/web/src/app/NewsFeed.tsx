"use client";

import { useState } from "react";
import type { PublicStory } from "../lib/publicStories";
import styles from "./NewsFeed.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

const CATEGORY_ORDER = ["ekonomi", "teknoloji", "spor", "dunya", "saglik", "kultur_sanat"];

// A busy category (ekonomi, spor) can carry dozens of stories on an active
// day — showing all of them at once is what made the homepage feel like an
// unbroken wall of text. Six gives a real front-page glance per section
// without hiding anything permanently (readers can still expand).
const INITIAL_VISIBLE = 6;

const PUBLISHED_AT_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul"
});

function formatPublishedAt(date: Date): string {
  return PUBLISHED_AT_FORMAT.format(date);
}

function CategorySection({
  id,
  title,
  items
}: {
  id: string;
  title: string;
  items: PublicStory[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div className={styles.section} id={id}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={styles.sectionCount}>{items.length} haber</span>
      </div>

      <div className={styles.grid}>
        {visible.map((story) => (
          <article className={styles.story} key={story.id}>
            <h4 className={styles.storyTitle}>{story.canonicalTitle}</h4>
            <p className={styles.summary}>{story.aiSummaryTr}</p>
            {story.sources.length > 0 && (
              <p className={styles.sources}>
                {formatPublishedAt(story.publishedAt)} &middot; Kaynak:{" "}
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
        <h2 className={styles.feedTitle}>Haberler</h2>
        <p className={styles.empty}>
          Henüz özetlenmiş haber yok — yapay zekâ üzerinde çalışıyor, birazdan burada olacak.
        </p>
      </section>
    );
  }

  const breakingStories = stories.filter((s) => s.isBreaking);

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: stories.filter((s) => s.category === category)
  })).filter((group) => group.items.length > 0);

  return (
    <section className={styles.feed}>
      <h2 className={styles.feedTitle}>Haberler</h2>
      <p className={styles.feedSubtitle}>En yeni haberler en üstte.</p>

      <nav className={styles.categoryNav} aria-label="Kategoriler">
        {breakingStories.length > 0 && (
          <a href="#son-dakika" className={styles.categoryLink}>
            Son Dakika
          </a>
        )}
        {byCategory.map(({ category }) => (
          <a key={category} href={`#kategori-${category}`} className={styles.categoryLink}>
            {CATEGORY_LABELS[category] ?? category}
          </a>
        ))}
      </nav>

      {breakingStories.length > 0 && (
        <CategorySection id="son-dakika" title="Son Dakika" items={breakingStories} />
      )}

      {byCategory.map(({ category, items }) => (
        <CategorySection
          key={category}
          id={`kategori-${category}`}
          title={CATEGORY_LABELS[category] ?? category}
          items={items}
        />
      ))}
    </section>
  );
}
