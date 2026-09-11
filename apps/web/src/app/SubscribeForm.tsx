"use client";

import { useState } from "react";
import styles from "./SubscribeForm.module.css";
import { SUBSCRIBER_CATEGORY_OPTIONS } from "../lib/categories";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error" | "rate_limited">("idle");

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
    if (res.ok) {
      setStatus("done");
    } else if (res.status === 429) {
      setStatus("rate_limited");
    } else {
      setStatus("error");
    }
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
          {SUBSCRIBER_CATEGORY_OPTIONS.map((c) => (
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

      {/* honeypot: a genuinely hidden input (type="hidden") that no browser
          autofill or password manager will ever populate, unlike a
          CSS-hidden visible input — which real users' autofill was tripping,
          silently swallowing their subscription with a fake success. Only a
          script that blindly fills every <input> regardless of type reaches it. */}
      <input type="hidden" name="company" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />


      <button type="submit" className={styles.submit} disabled={status === "loading" || selected.length === 0}>
        Abone Ol
      </button>
      {status === "error" && <p className={styles.error} role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
      {status === "rate_limited" && (
        <p className={styles.error} role="alert">Çok hızlı denedin, birkaç saniye bekleyip tekrar dener misin?</p>
      )}
    </form>
  );
}
