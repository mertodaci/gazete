import { describe, expect, it, vi, beforeEach } from "vitest";
import { isHoneypotTripped, checkRateLimit } from "./rateLimit";

describe("isHoneypotTripped", () => {
  it("is tripped when the honeypot field has any value", () => {
    expect(isHoneypotTripped("bot filled this")).toBe(true);
  });

  it("is not tripped when empty or undefined", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request from an IP", () => {
    expect(checkRateLimit("1.2.3.4")).toBe(true);
  });

  it("blocks a second request from the same IP within the window", () => {
    checkRateLimit("5.6.7.8");
    expect(checkRateLimit("5.6.7.8")).toBe(false);
  });

  it("allows a request from a different IP", () => {
    checkRateLimit("9.9.9.9");
    expect(checkRateLimit("8.8.8.8")).toBe(true);
  });
});
