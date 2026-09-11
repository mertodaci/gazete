export interface Quote {
  price: number;
  changePercent: number;
}

export interface StockQuote extends Quote {
  symbol: string;
}

export interface MarketSnapshot {
  bist100: Quote;
  gold: Quote;
  silver: Quote;
  stocks: StockQuote[];
}

// 20 liquid BIST100 constituents — a fixed, hand-picked list rather than a
// dynamic "top movers" query, since there's no free unauthenticated endpoint
// that ranks the whole index for us. Mirrors apps/web/src/lib/marketData.ts.
const STOCK_SYMBOLS = [
  "THYAO",
  "GARAN",
  "AKBNK",
  "ISCTR",
  "SISE",
  "EREGL",
  "BIMAS",
  "TUPRS",
  "KCHOL",
  "SAHOL",
  "ASELS",
  "FROTO",
  "TOASO",
  "PGSUS",
  "TCELL",
  "YKBNK",
  "VAKBN",
  "HALKB",
  "ARCLK",
  "SASA"
];

// A free, unauthenticated public endpoint — not an officially supported API,
// so any failure (network, shape change, downtime) must degrade to "leave
// this quote out" rather than fail the digest send.
async function fetchQuote(yahooSymbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`);
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const changePercent = meta?.regularMarketChangePercent;
    if (typeof price !== "number" || typeof changePercent !== "number") return null;
    return { price, changePercent };
  } catch {
    return null;
  }
}

async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const quote = await fetchQuote(`${symbol}.IS`);
  return quote ? { symbol, ...quote } : null;
}

// truncgil returns both the price and its daily change as Turkish-formatted
// strings (e.g. "6.824,86", "%1,31" — "." as thousands separator, "," as
// decimal), which plain Number() would misparse (or NaN) — strip thousands
// dots, then swap the decimal comma for a dot.
function parseTurkishNumber(value: unknown): number {
  if (typeof value !== "string") return NaN;
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function parseTurkishPercent(value: unknown): number {
  if (typeof value !== "string") return NaN;
  return parseTurkishNumber(value.replace("%", ""));
}

async function fetchGoldAndSilver(): Promise<{ gold: Quote; silver: Quote } | null> {
  try {
    const res = await fetch("https://finans.truncgil.com/today.json");
    if (!res.ok) return null;
    const json = await res.json();
    const gold: Quote = {
      price: parseTurkishNumber(json?.["gram-altin"]?.["Satış"]),
      changePercent: parseTurkishPercent(json?.["gram-altin"]?.["Değişim"])
    };
    const silver: Quote = {
      price: parseTurkishNumber(json?.["gumus"]?.["Satış"]),
      changePercent: parseTurkishPercent(json?.["gumus"]?.["Değişim"])
    };
    if (![gold.price, gold.changePercent, silver.price, silver.changePercent].every(Number.isFinite)) return null;
    return { gold, silver };
  } catch {
    return null;
  }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot | null> {
  const [bist100, metals, stockResults] = await Promise.all([
    fetchQuote("XU100.IS"),
    fetchGoldAndSilver(),
    Promise.all(STOCK_SYMBOLS.map(fetchStockQuote))
  ]);
  if (!bist100 || !metals) return null;
  const stocks = stockResults.filter((s): s is StockQuote => s !== null);
  return { bist100, gold: metals.gold, silver: metals.silver, stocks };
}
