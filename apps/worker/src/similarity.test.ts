import { describe, expect, it } from "vitest";
import { titleSimilarity } from "./similarity";

describe("titleSimilarity", () => {
  it("returns 1 for identical titles", () => {
    expect(titleSimilarity("Merkez Bankası faiz kararını açıkladı", "Merkez Bankası faiz kararını açıkladı")).toBe(1);
  });

  it("returns a high score for near-duplicate headlines about the same event", () => {
    const a = "Merkez Bankası faiz kararını açıkladı";
    const b = "Merkez Bankası faiz kararını duyurdu";
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.5);
  });

  it("returns a low score for unrelated headlines", () => {
    const a = "Merkez Bankası faiz kararını açıkladı";
    const b = "Galatasaray derbide 3 gol attı";
    expect(titleSimilarity(a, b)).toBeLessThan(0.2);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(titleSimilarity("Ali, İstanbul'a gitti!", "ali istanbula gitti")).toBeGreaterThan(0.7);
  });
});
