"use client";

import { useState } from "react";
import styles from "./SubscribeForm.module.css";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "gundem", label: "Gündem" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "teknoloji", label: "Teknoloji" },
  { value: "spor", label: "Spor" },
  { value: "dunya", label: "Dünya" },
  { value: "saglik", label: "Sağlık" },
  { value: "kultur_sanat", label: "Kültür-Sanat" }
];

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, categories: selected, honeypot })
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <p className={styles.confirmation}>
        Teşekkürler! Yarın sabah 09.00&apos;dan itibaren bültenini almaya başlayacaksın.
      </p>
    );
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="email">E-posta</label>
        <input
          id="email"
          type="email"
          placeholder="sen@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className={styles.chipsLegend}>İlgilendiğin kategoriler</legend>
        <div className={styles.chips}>
          {CATEGORIES.map((c) => (
            <span className={styles.chip} key={c.value}>
              <input
                type="checkbox"
                id={`cat-${c.value}`}
                className={styles.chipInput}
                checked={selected.includes(c.value)}
                onChange={() => toggle(c.value)}
              />
              <label htmlFor={`cat-${c.value}`} className={styles.chipLabel}>
                {c.label}
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      {/* honeypot: hidden from real users, bots tend to fill every field */}
      <input
        type="text"
        name="company"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className={styles.honeypot}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <button type="submit" className={styles.submit} disabled={status === "loading" || selected.length === 0}>
        Abone Ol
      </button>
      {status === "error" && <p className={styles.error} role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
    </form>
  );
}
