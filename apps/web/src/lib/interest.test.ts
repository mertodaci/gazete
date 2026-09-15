import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./moderation", () => ({ isInterestTextAllowed: vi.fn() }));
vi.mock("./embeddings", () => ({ getEmbedding: vi.fn() }));

import { processInterestText } from "./interest";
import { isInterestTextAllowed } from "./moderation";
import { getEmbedding } from "./embeddings";

describe("processInterestText", () => {
  beforeEach(() => {
    vi.mocked(isInterestTextAllowed).mockReset();
    vi.mocked(getEmbedding).mockReset();
  });

  it("returns null/empty without calling moderation or embedding when the input is empty or whitespace", async () => {
    expect(await processInterestText(undefined)).toEqual({
      interestText: null,
      interestEmbedding: [],
      rejected: false
    });
    expect(await processInterestText("   ")).toEqual({ interestText: null, interestEmbedding: [], rejected: false });
    expect(isInterestTextAllowed).not.toHaveBeenCalled();
    expect(getEmbedding).not.toHaveBeenCalled();
  });

  it("rejects text longer than the length cap without calling moderation or embedding", async () => {
    const tooLong = "a".repeat(300);
    const result = await processInterestText(tooLong);
    expect(result).toEqual({ interestText: null, interestEmbedding: [], rejected: true });
    expect(isInterestTextAllowed).not.toHaveBeenCalled();
    expect(getEmbedding).not.toHaveBeenCalled();
  });

  it("rejects text that fails moderation, without computing an embedding", async () => {
    vi.mocked(isInterestTextAllowed).mockResolvedValue(false);
    const result = await processInterestText("kötüye kullanım denemesi");
    expect(result).toEqual({ interestText: null, interestEmbedding: [], rejected: true });
    expect(getEmbedding).not.toHaveBeenCalled();
  });

  it("returns the trimmed text and its embedding when moderation passes", async () => {
    vi.mocked(isInterestTextAllowed).mockResolvedValue(true);
    vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
    const result = await processInterestText("  deprem, yapay zeka  ");
    expect(result).toEqual({ interestText: "deprem, yapay zeka", interestEmbedding: [0.1, 0.2, 0.3], rejected: false });
  });

  it("still stores the moderated text with an empty embedding when the embedding call fails", async () => {
    vi.mocked(isInterestTextAllowed).mockResolvedValue(true);
    vi.mocked(getEmbedding).mockResolvedValue(null);
    const result = await processInterestText("deprem");
    expect(result).toEqual({ interestText: "deprem", interestEmbedding: [], rejected: false });
  });
});
