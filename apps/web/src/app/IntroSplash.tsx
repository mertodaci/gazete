"use client";

import { useEffect, useState } from "react";
import styles from "./IntroSplash.module.css";

// A brief, one-time full-screen reveal of the brand mark on first paint —
// purely decorative, so it's hidden from assistive tech and removed from
// the DOM once its fade-out finishes (matches the CSS animation timings
// below: 0.45s mark-in + 0.15s stagger + 0.75s hold + 0.25s fade-out).
const TOTAL_DURATION_MS = 1000;

export function IntroSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), TOTAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.splash} aria-hidden="true">
      <svg className={styles.mark} viewBox="0 0 30 20" role="img" aria-label="Türkiye'nin Gazetesi">
        <path
          className={styles.first}
          d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z"
        />
        <path
          className={styles.second}
          d="M13 12C13 6 17 2 22 1L23 3.2C19.5 4.3 17.5 6.7 17.3 9.5C18 9.1 18.8 9 19.6 9.2C21.3 9.6 22.3 11 22 12.7C21.7 14.4 20.1 15.5 18.3 15.2C15.6 14.7 13.3 14.3 13 12Z"
        />
      </svg>
    </div>
  );
}
