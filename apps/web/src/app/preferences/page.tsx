import styles from "../formPage.module.css";
import { PreferencesForm } from "./PreferencesForm";

export default function PreferencesPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className={styles.page}>
      <p className={styles.wordmark}>Türkiye&apos;nin Gazetesi</p>
      {searchParams.token ? (
        <>
          <h1 className={styles.title}>Tercihlerini güncelle</h1>
          <PreferencesForm token={searchParams.token} />
        </>
      ) : (
        <p className={styles.message}>Eksik bağlantı.</p>
      )}
    </main>
  );
}
