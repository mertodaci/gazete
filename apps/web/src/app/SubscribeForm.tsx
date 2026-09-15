"use client";

import { useState } from "react";
import styles from "./SubscribeForm.module.css";
import { SUBSCRIBER_CATEGORY_OPTIONS } from "../lib/categories";
import { MAX_INTEREST_TEXT_LENGTH } from "@gazete/db";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [interestText, setInterestText] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "error" | "rate_limited" | "interest_rejected_and_no_categories"
  >("idle");
  const [interestRejected, setInterestRejected] = useState(false);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, categories: selected, honeypot, interestText })
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      setInterestRejected(Boolean(json.interestRejected));
      setStatus("done");
    } else if (res.status === 429) {
      setStatus("rate_limited");
    } else {
      const json = await res.json().catch(() => ({}));
      setStatus(json.error === "interest_rejected_and_no_categories" ? "interest_rejected_and_no_categories" : "error");
    }
  }

  if (status === "done") {
    return (
      <p className={styles.confirmation}>
        Teşekkürler! Yarın sabah 09.00&apos;dan itibaren bültenini almaya başlayacaksın.
        {interestRejected && (
          <>
            {" "}
            (İlgi alanı olarak yazdığın metin kabul edilemedi, kategorilerin yine de kaydedildi — tercihler
            sayfasından tekrar deneyebilirsin.)
          </>
        )}
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

      <div className={styles.interestBlock}>
        <label htmlFor="interestText" className={styles.interestLabel}>
          Sana özel bir haber akışı
        </label>
        <p className={styles.interestDescription}>
          Yukarıdaki kategorilerin ötesinde — istediğin herhangi bir konuyu yaz, yapay zekâmız o konudaki haberleri
          bulup senin için mail&apos;ine eklesin.
        </p>
        <textarea
          id="interestText"
          className={styles.interestInput}
          placeholder="örn. yapay zeka, deprem, İzmir haberleri"
          rows={2}
          maxLength={MAX_INTEREST_TEXT_LENGTH}
          value={interestText}
          onChange={(e) => setInterestText(e.target.value)}
        />
        <span className={styles.interestHint}>
          {interestText.length}/{MAX_INTEREST_TEXT_LENGTH}
        </span>
      </div>

      {/* honeypot: a genuinely hidden input (type="hidden") that no browser
          autofill or password manager will ever populate, unlike a
          CSS-hidden visible input — which real users' autofill was tripping,
          silently swallowing their subscription with a fake success. Only a
          script that blindly fills every <input> regardless of type reaches it. */}
      <input type="hidden" name="company" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />


      <button
        type="submit"
        className={styles.submit}
        disabled={status === "loading" || (selected.length === 0 && interestText.trim().length === 0)}
      >
        Abone Ol
      </button>
      {status === "error" && <p className={styles.error} role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
      {status === "rate_limited" && (
        <p className={styles.error} role="alert">Çok hızlı denedin, birkaç saniye bekleyip tekrar dener misin?</p>
      )}
      {status === "interest_rejected_and_no_categories" && (
        <p className={styles.error} role="alert">
          Yazdığın ilgi alanı metni kabul edilemedi ve hiç kategori seçmedin — en az bir kategori seç ya da farklı
          bir ilgi alanı yaz.
        </p>
      )}
    </form>
  );
}
