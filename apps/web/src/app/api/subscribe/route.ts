import { prisma, Category } from "@gazete/db";
import { generateToken } from "@/lib/token";
import { isHoneypotTripped, checkRateLimit } from "@/lib/rateLimit";
import { sendWelcomeEmail } from "@/lib/email";

const VALID_CATEGORIES = Object.values(Category);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
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

  if (!categories || categories.length === 0 || !categories.every((c) => VALID_CATEGORIES.includes(c as Category))) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }

  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    await prisma.subscriberCategory.deleteMany({ where: { subscriberId: existing.id } });
    await prisma.subscriberCategory.createMany({
      data: categories.map((category) => ({ subscriberId: existing.id, category: category as Category }))
    });
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
