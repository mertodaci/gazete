"use client";

import { useEffect, useState } from "react";
import styles from "../formPage.module.css";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "gundem", label: "Gündem" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "teknoloji", label: "Teknoloji" },
  { value: "spor", label: "Spor" },
  { value: "dunya", label: "Dünya" },
  { value: "saglik", label: "Sağlık" },
  { value: "kultur_sanat", label: "Kültür-Sanat" }
];

export function PreferencesForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/preferences?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setSelected(json.categories);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, categories: selected })
    });
    setSaved(res.ok);
  }

  if (loading) return <p className={styles.message}>Yükleniyor…</p>;
  if (notFound) return <p className={styles.message}>Bu bağlantı geçersiz.</p>;

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <fieldset>
        <legend className={styles.sectionsLegend}>Bölümlerin</legend>
        <ul className={styles.sections}>
          {CATEGORIES.map((c) => (
            <li key={c.value}>
              <label className={styles.sectionRow}>
                <input type="checkbox" checked={selected.includes(c.value)} onChange={() => toggle(c.value)} />
                {c.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" className={styles.submit} disabled={selected.length === 0}>
        Kaydet
      </button>
      {saved && <p className={styles.saved}>Kaydedildi.</p>}
    </form>
  );
}
