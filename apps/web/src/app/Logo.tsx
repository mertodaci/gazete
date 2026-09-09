import styles from "./Logo.module.css";

export function Logo({ fontSize }: { fontSize?: string } = {}) {
  return (
    <span className={styles.logo} style={fontSize ? { fontSize } : undefined}>
      <svg className={styles.mark} viewBox="0 0 30 20" role="img" aria-label="Türkiye'nin Gazetesi">
        <path d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z" />
        <path
          d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z"
          transform="translate(11,0)"
        />
      </svg>
      <span className={styles.word}>Türkiye&apos;nin Gazetesi</span>
    </span>
  );
}
