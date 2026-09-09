import styles from "./page.module.css";
import { SubscribeForm } from "./SubscribeForm";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>Gazete</h1>
        <p className={styles.kicker}>
          Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük Türkçe haber bülteni.
        </p>
      </header>
      <SubscribeForm />
    </main>
  );
}
