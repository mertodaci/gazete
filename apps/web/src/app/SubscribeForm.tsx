"use client";

import { useState } from "react";

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
      body: JSON.stringify({ email, categories: selected, honeypot: "" })
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return <p>Teşekkürler! Yarın sabah 09:00&apos;dan itibaren bültenini almaya başlayacaksın.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">E-posta</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <fieldset>
        <legend>İlgilendiğin kategoriler</legend>
        {CATEGORIES.map((c) => (
          <label key={c.value}>
            <input
              type="checkbox"
              checked={selected.includes(c.value)}
              onChange={() => toggle(c.value)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      {/* honeypot: hidden from real users, bots tend to fill every field */}
      <input type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

      <button type="submit" disabled={status === "loading" || selected.length === 0}>
        Abone Ol
      </button>
      {status === "error" && <p role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
    </form>
  );
}
