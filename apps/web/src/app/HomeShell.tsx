"use client";

import { useEffect, useState } from "react";
import styles from "./HomeShell.module.css";
import { Logo } from "./Logo";
import { SubscribeForm } from "./SubscribeForm";
import { NewsFeed } from "./NewsFeed";
import type { PublicStory } from "../lib/publicStories";

const DISMISSED_KEY = "gazete-subscribe-dismissed";

export function HomeShell({ stories }: { stories: PublicStory[] }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let dismissed: string | null = null;
    try {
      dismissed = sessionStorage.getItem(DISMISSED_KEY);
    } catch {
      // sessionStorage unavailable (private browsing etc.) — just show the modal.
    }
    if (!dismissed) setShowModal(true);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  function close() {
    setShowModal(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore — worst case the modal reappears next time.
    }
  }

  return (
    <>
      <header className={styles.header}>
        <Logo />
        <button type="button" className={styles.headerCta} onClick={() => setShowModal(true)}>
          Abone Ol
        </button>
      </header>

      <main className={styles.page}>
        <NewsFeed stories={stories} />
      </main>

      {showModal && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className={styles.close} onClick={close} aria-label="Kapat">
              ×
            </button>
            <span className={styles.freeBadge}>Tamamen ücretsiz</span>
            <h1 className={styles.headline}>
              Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük haber bülteni.
            </h1>
            <p className={styles.subtext}>Her sabah 09.00&apos;da kutunda olsun.</p>
            <SubscribeForm />
          </div>
        </div>
      )}
    </>
  );
}
