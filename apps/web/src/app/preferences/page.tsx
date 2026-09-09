import styles from "../formPage.module.css";
import { Logo } from "../Logo";
import { PreferencesForm } from "./PreferencesForm";

export default function PreferencesPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className={styles.page}>
      <div className={styles.wordmark}>
        <Logo fontSize="1.375rem" />
      </div>
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
