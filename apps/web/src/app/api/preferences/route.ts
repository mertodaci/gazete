import { prisma, Category } from "@gazete/db";
import { SUBSCRIBER_SELECTABLE_CATEGORIES } from "@/lib/categories";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

  const subscriber = await prisma.subscriber.findUnique({
    where: { preferencesToken: token },
    include: { categories: true }
  });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    email: subscriber.email,
    categories: subscriber.categories.map((c) => c.category)
  });
}

export async function POST(request: Request): Promise<Response> {
  const { token, categories } = (await request.json()) as { token?: string; categories?: string[] };

  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });
  if (
    !categories ||
    categories.length === 0 ||
    !categories.every((c) => SUBSCRIBER_SELECTABLE_CATEGORIES.includes(c as Category))
  ) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.findUnique({ where: { preferencesToken: token } });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.subscriberCategory.deleteMany({ where: { subscriberId: subscriber.id } });
  await prisma.subscriberCategory.createMany({
    data: categories.map((category) => ({ subscriberId: subscriber.id, category: category as Category }))
  });

  return Response.json({ ok: true });
}
