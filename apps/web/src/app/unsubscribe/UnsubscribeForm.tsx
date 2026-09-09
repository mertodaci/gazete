"use client";

import { useState } from "react";

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

  if (status === "done") return <p>Abonelikten çıkıldı. İyi günler dileriz.</p>;
  if (status === "invalid") return <p>Bu bağlantı geçersiz.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <p>Abonelikten çıkmak istediğine emin misin?</p>
      <button type="submit" disabled={status === "loading"}>
        Abonelikten çık
      </button>
      {status === "error" && <p role="alert">Bir şeyler ters gitti, tekrar dener misin?</p>}
    </form>
  );
}
