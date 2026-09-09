import styles from "./page.module.css";
import { SubscribeForm } from "./SubscribeForm";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.badge} aria-hidden="true">G</div>
      <h1 className={styles.headline}>
        Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük haber bülteni.
      </h1>
      <p className={styles.subtext}>
        Gazete&apos;ye ücretsiz abone ol, her sabah 09.00&apos;da kutunda olsun.
      </p>
      <SubscribeForm />
    </main>
  );
}
