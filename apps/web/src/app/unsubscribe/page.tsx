import styles from "../formPage.module.css";
import { UnsubscribeForm } from "./UnsubscribeForm";

// A plain GET must never unsubscribe: corporate mail scanners and antivirus
// gateways prefetch every link in an email, which would silently unsubscribe
// real users. RFC 8058 one-click unsubscribe requires a POST, so this page only
// renders a confirmation button that POSTs to /api/unsubscribe.
export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className={styles.page}>
      <p className={styles.wordmark}>Türkiye&apos;nin Gazetesi</p>
      {searchParams.token ? (
        <>
          <h1 className={styles.title}>Abonelikten çık</h1>
          <UnsubscribeForm token={searchParams.token} />
        </>
      ) : (
        <p className={styles.message}>Eksik bağlantı.</p>
      )}
    </main>
  );
}
