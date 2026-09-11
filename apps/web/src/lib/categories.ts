import { Category } from "@gazete/db";

// The categories a subscriber can actually pick, in display order. "gundem"
// is deliberately excluded — it's an internal fallback for content that
// doesn't fit any real topic (see apps/worker/src/summarize.ts) and is never
// shown to users. "son_dakika" ("Son Dakika") is a cross-cutting breaking-news
// opt-in, not a real topic, but it is user-selectable.
export const SUBSCRIBER_CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: Category.ekonomi, label: "Ekonomi" },
  { value: Category.teknoloji, label: "Teknoloji" },
  { value: Category.spor, label: "Spor" },
  { value: Category.dunya, label: "Dünya" },
  { value: Category.saglik, label: "Sağlık" },
  { value: Category.kultur_sanat, label: "Kültür-Sanat" },
  { value: Category.son_dakika, label: "Son Dakika" }
];

export const SUBSCRIBER_SELECTABLE_CATEGORIES: Category[] = Object.values(Category).filter(
  (c) => c !== Category.gundem
);
