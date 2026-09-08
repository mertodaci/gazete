try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // .env not present (e.g. production, where real env vars are injected) — ignore.
}

export const config = {
  timezone: "Europe/Istanbul",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY as string,
  resendApiKey: process.env.RESEND_API_KEY as string,
  fromEmail: process.env.FROM_EMAIL as string,
  baseUrl: process.env.BASE_URL as string
};
