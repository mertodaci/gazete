// Normalize the dotted/dotless I pair explicitly before lowercasing. Engines
// disagree on whether a plain "I" lowercases to "ı" under the tr-TR locale, so
// an ALL-CAPS headline could otherwise fail to token-match its mixed-case
// equivalent. Doing the mapping by hand makes it deterministic.
function normalizeTurkishI(text: string): string {
  return text.replace(/İ/g, "i").replace(/I/g, "ı");
}

function tokenize(title: string): Set<string> {
  return new Set(
    normalizeTurkishI(title)
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((token) => token.length > 0)
  );
}

export function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 && tokensB.size === 0) return 1;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
