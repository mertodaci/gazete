import type { MarketSnapshot } from "../lib/marketData";
import styles from "./MarketTicker.module.css";

const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TickerItem({ label, price, changePercent }: { label: string; price: number; changePercent: number }) {
  const isUp = changePercent >= 0;
  return (
    <span className={styles.item}>
      {label} {NUMBER_FORMAT.format(price)} ₺{" "}
      <span className={isUp ? styles.up : styles.down}>
        {isUp ? "▲" : "▼"}
        {PERCENT_FORMAT.format(Math.abs(changePercent))}%
      </span>
    </span>
  );
}

function TickerItems({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <>
      <TickerItem label="BIST 100" price={snapshot.bist100.price} changePercent={snapshot.bist100.changePercent} />
      <TickerItem label="Gram Altın" price={snapshot.gold.price} changePercent={snapshot.gold.changePercent} />
      <TickerItem label="Gümüş" price={snapshot.silver.price} changePercent={snapshot.silver.changePercent} />
      {snapshot.stocks.map((stock) => (
        <TickerItem key={stock.symbol} label={stock.symbol} price={stock.price} changePercent={stock.changePercent} />
      ))}
    </>
  );
}

export function MarketTicker({ snapshot }: { snapshot: MarketSnapshot | null }) {
  if (!snapshot) return null;

  return (
    <div className={styles.ticker} role="status" aria-label="Piyasa verileri">
      <div className={styles.track}>
        <div className={styles.group}>
          <TickerItems snapshot={snapshot} />
        </div>
        <div className={styles.group} aria-hidden="true">
          <TickerItems snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
