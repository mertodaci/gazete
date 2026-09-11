import { prisma, Category } from "@gazete/db";
import { generateToken } from "@/lib/token";
import { isHoneypotTripped, checkRateLimit } from "@/lib/rateLimit";
import { sendWelcomeEmail } from "@/lib/email";
import { SUBSCRIBER_SELECTABLE_CATEGORIES } from "@/lib/categories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the client IP for rate-limiting purposes.
 *
 * nginx sets `X-Real-IP` with `$remote_addr`, which *overwrites* whatever the
 * client sent, so it cannot be spoofed. `X-Forwarded-For` uses
 * `$proxy_add_x_forwarded_for`, which *appends* to the client-supplied value —
 * trusting it verbatim would let a client mint a fresh rate-limit key on every
 * request. So only fall back to it (taking the last, proxy-appended segment)
 * when `X-Real-IP` is absent, i.e. local dev with no nginx in front.
 */
function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const segments = forwardedFor.split(",");
    return segments[segments.length - 1].trim();
  }

  return "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request);
  const body = await request.json();
  const { email, categories, honeypot } = body as {
    email?: string;
    categories?: string[];
    honeypot?: string;
  };

  if (isHoneypotTripped(honeypot)) {
    // Pretend success so the bot doesn't learn anything, but do nothing.
    return Response.json({ ok: true }, { status: 201 });
  }

  if (!checkRateLimit(ip)) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  if (
    !categories ||
    categories.length === 0 ||
    !categories.every((c) => SUBSCRIBER_SELECTABLE_CATEGORIES.includes(c as Category))
  ) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }

  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    await prisma.subscriberCategory.deleteMany({ where: { subscriberId: existing.id } });
    await prisma.subscriberCategory.createMany({
      data: categories.map((category) => ({ subscriberId: existing.id, category: category as Category }))
    });
    // Re-subscribing must reactivate someone who previously unsubscribed (or
    // was unsubscribed by a hard bounce) — otherwise they could never come back.
    await prisma.subscriber.update({ where: { id: existing.id }, data: { status: "active" } });
    return Response.json({ ok: true }, { status: 201 });
  }

  const preferencesToken = generateToken();
  const subscriber = await prisma.subscriber.create({
    data: {
      email,
      preferencesToken,
      categories: {
        create: categories.map((category) => ({ category: category as Category }))
      }
    }
  });

  await sendWelcomeEmail(subscriber.email, preferencesToken);

  return Response.json({ ok: true }, { status: 201 });
}
