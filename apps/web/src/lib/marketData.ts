export interface MarketSnapshot {
  bist100: number;
  goldGramTl: number;
  silverGramTl: number;
}

// Two free, unauthenticated public endpoints — neither is an officially
// supported API, so any failure (network, shape change, downtime) must
// degrade to "don't show the ticker" rather than break the page. `revalidate`
// caches the result for 5 minutes so a page view never blocks on a live
// external call, and we don't hammer either service on every request.
async function fetchBist100(): Promise<number | null> {
  try {
    const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS", {
      next: { revalidate: 300 }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

// truncgil returns "Satış" as a Turkish-formatted number string (e.g.
// "6.824,86" — "." as thousands separator, "," as decimal), which plain
// Number() would misparse (or NaN) — strip thousands dots, then swap the
// decimal comma for a dot.
function parseTurkishNumber(value: unknown): number {
  if (typeof value !== "string") return NaN;
  return Number(value.replace(/\./g, "").replace(",", "."));
}

async function fetchGoldAndSilver(): Promise<{ goldGramTl: number; silverGramTl: number } | null> {
  try {
    const res = await fetch("https://finans.truncgil.com/today.json", { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    const gold = parseTurkishNumber(json?.["gram-altin"]?.["Satış"]);
    const silver = parseTurkishNumber(json?.["gumus"]?.["Satış"]);
    if (!Number.isFinite(gold) || !Number.isFinite(silver)) return null;
    return { goldGramTl: gold, silverGramTl: silver };
  } catch {
    return null;
  }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot | null> {
  const [bist100, preciousMetals] = await Promise.all([fetchBist100(), fetchGoldAndSilver()]);
  if (bist100 === null || preciousMetals === null) return null;
  return { bist100, ...preciousMetals };
}
