import { UnsubscribeForm } from "./UnsubscribeForm";

// A plain GET must never unsubscribe: corporate mail scanners and antivirus
// gateways prefetch every link in an email, which would silently unsubscribe
// real users. RFC 8058 one-click unsubscribe requires a POST, so this page only
// renders a confirmation button that POSTs to /api/unsubscribe.
export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p>Eksik bağlantı.</p>;
  return (
    <main>
      <h1>Abonelikten Çık</h1>
      <UnsubscribeForm token={searchParams.token} />
    </main>
  );
}
