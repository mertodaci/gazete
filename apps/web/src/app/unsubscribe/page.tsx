async function unsubscribe(token: string) {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/unsubscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store"
  });
  return res.ok;
}

export default async function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p>Eksik bağlantı.</p>;
  const ok = await unsubscribe(searchParams.token);
  return <main>{ok ? <p>Abonelikten çıkıldı. İyi günler dileriz.</p> : <p>Bu bağlantı geçersiz.</p>}</main>;
}
