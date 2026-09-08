function tokenize(title: string): Set<string> {
  return new Set(
    title
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
