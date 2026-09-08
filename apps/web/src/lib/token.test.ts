import { describe, expect, it } from "vitest";
import { generateToken } from "./token";

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different value each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
