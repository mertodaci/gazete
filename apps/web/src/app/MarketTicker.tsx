import type { MarketSnapshot } from "../lib/marketData";
import styles from "./MarketTicker.module.css";

const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildItems(snapshot: MarketSnapshot): string {
  return [
    `BIST 100 ${NUMBER_FORMAT.format(snapshot.bist100)}`,
    `Gram Altın ${NUMBER_FORMAT.format(snapshot.goldGramTl)} ₺`,
    `Gümüş ${NUMBER_FORMAT.format(snapshot.silverGramTl)} ₺`
  ].join("   •   ");
}

export function MarketTicker({ snapshot }: { snapshot: MarketSnapshot | null }) {
  if (!snapshot) return null;

  const text = buildItems(snapshot);

  return (
    <div className={styles.ticker} role="status" aria-label="Piyasa verileri">
      <div className={styles.track}>
        <span className={styles.item}>{text}</span>
        <span className={styles.item} aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}
