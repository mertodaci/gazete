"use client";

import { useState } from "react";
import styles from "../formPage.module.css";

export function UnsubscribeForm({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "invalid" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (res.ok) setStatus("done");
      else if (res.status === 404 || res.status === 400) setStatus("invalid");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") return <p className={styles.message}>Abonelikten çıkıldı. İyi günler dileriz.</p>;
  if (status === "invalid") return <p className={styles.message}>Bu bağlantı geçersiz.</p>;

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <p className={styles.message} style={{ marginBottom: "1.25rem" }}>
        Abonelikten çıkmak istediğine emin misin?
      </p>
      <button type="submit" className={styles.submit} disabled={status === "loading"}>
        Abonelikten çık
      </button>
      {status === "error" && (
        <p className={styles.saved} role="alert">
          Bir şeyler ters gitti, tekrar dener misin?
        </p>
      )}
    </form>
  );
}
