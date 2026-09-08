import { randomBytes } from "node:crypto";

export function generateTestToken(): string {
  return randomBytes(16).toString("hex");
}
