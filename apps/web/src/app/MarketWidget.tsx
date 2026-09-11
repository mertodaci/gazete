import type { MarketSnapshot } from "../lib/marketData";
import styles from "./MarketWidget.module.css";

const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ChangeBadge({ changePercent }: { changePercent: number }) {
  const isUp = changePercent >= 0;
  return (
    <span className={isUp ? styles.up : styles.down}>
      {isUp ? "▲" : "▼"}
      {PERCENT_FORMAT.format(Math.abs(changePercent))}%
    </span>
  );
}

function Row({ label, price, changePercent }: { label: string; price: number; changePercent: number }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.price}>{NUMBER_FORMAT.format(price)}</span>
      <ChangeBadge changePercent={changePercent} />
    </div>
  );
}

export function MarketWidget({ snapshot }: { snapshot: MarketSnapshot | null }) {
  if (!snapshot) return null;

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>Piyasalar</h3>

      <div className={styles.headline}>
        <Row label="BIST 100" price={snapshot.bist100.price} changePercent={snapshot.bist100.changePercent} />
        <Row label="Gram Altın ₺" price={snapshot.gold.price} changePercent={snapshot.gold.changePercent} />
        <Row label="Gümüş ₺" price={snapshot.silver.price} changePercent={snapshot.silver.changePercent} />
      </div>

      <div className={styles.divider} />

      <div className={styles.stocks}>
        {snapshot.stocks.map((stock) => (
          <Row key={stock.symbol} label={stock.symbol} price={stock.price} changePercent={stock.changePercent} />
        ))}
      </div>
    </div>
  );
}
