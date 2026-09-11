"use client";

import { useEffect, useState } from "react";
import styles from "../formPage.module.css";
import { SUBSCRIBER_CATEGORY_OPTIONS } from "../../lib/categories";

export function PreferencesForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const SELECTABLE_VALUES = SUBSCRIBER_CATEGORY_OPTIONS.map((c) => c.value as string);

  useEffect(() => {
    fetch(`/api/preferences?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        if (json.status !== "active") {
          setInactive(true);
          return;
        }
        // A subscriber may still have a legacy category (e.g. "gundem", removed
        // from the selectable list) saved from before it was retired — it has
        // no checkbox to show, but leaving it in `selected` would make every
        // save fail server-side validation. Drop anything that can't be shown.
        setSelected(
          (json.categories as string[]).filter((c) => SELECTABLE_VALUES.includes(c))
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setSaved(false);
    setError(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, categories: selected })
    });
    setSaved(res.ok);
    setError(!res.ok);
  }

  if (loading) return <p className={styles.message}>Yükleniyor…</p>;
  if (notFound) return <p className={styles.message}>Bu bağlantı geçersiz.</p>;
  if (inactive) return <p className={styles.message}>Bu abonelik artık aktif değil, bu yüzden tercihlerini güncelleyemezsin. Tekrar abone olmak istersen ana sayfayı ziyaret edebilirsin.</p>;

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <fieldset>
        <legend className={styles.chipsLegend}>Kategorilerin</legend>
        <div className={styles.chips}>
          {SUBSCRIBER_CATEGORY_OPTIONS.map((c) => (
            <span className={styles.chip} key={c.value}>
              <input
                type="checkbox"
                id={`pref-${c.value}`}
                className={styles.chipInput}
                checked={selected.includes(c.value)}
                onChange={() => toggle(c.value)}
              />
              <label htmlFor={`pref-${c.value}`} className={styles.chipLabel}>
                {c.label}
              </label>
            </span>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={styles.submit} disabled={selected.length === 0}>
        Kaydet
      </button>
      {saved && <p className={styles.saved}>Kaydedildi.</p>}
      {error && <p className={styles.error}>Bir şeyler ters gitti, tekrar dener misin?</p>}
    </form>
  );
}
