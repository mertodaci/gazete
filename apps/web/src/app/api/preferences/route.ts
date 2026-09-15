import { prisma, Category } from "@gazete/db";
import { SUBSCRIBER_SELECTABLE_CATEGORIES } from "@/lib/categories";
import { processInterestText } from "@/lib/interest";

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
    status: subscriber.status,
    categories: subscriber.categories.map((c) => c.category),
    interestText: subscriber.interestText
  });
}

export async function POST(request: Request): Promise<Response> {
  const { token, categories, interestText } = (await request.json()) as {
    token?: string;
    categories?: string[];
    interestText?: string;
  };

  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });
  const hasCategories = Boolean(categories && categories.length > 0);
  if (hasCategories && !categories!.every((c) => SUBSCRIBER_SELECTABLE_CATEGORIES.includes(c as Category))) {
    return Response.json({ error: "invalid_categories" }, { status: 400 });
  }
  // A subscriber can now rely entirely on the free-text interest instead of
  // the fixed categories — but needs at least one of the two, or there is
  // nothing to ever send them.
  if (!hasCategories && !interestText?.trim()) {
    return Response.json({ error: "missing_categories_or_interest" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.findUnique({ where: { preferencesToken: token } });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });
  // An unsubscribed account never receives a digest, so saved categories
  // would silently do nothing — reject the write instead of storing dead data.
  if (subscriber.status !== "active") return Response.json({ error: "not_active" }, { status: 409 });

  const interest = await processInterestText(interestText);

  // The only signal offered was the free text, and it didn't survive
  // moderation/validation — reject outright rather than silently leaving the
  // subscriber with nothing selected.
  if (!hasCategories && !interest.interestText) {
    return Response.json({ error: "interest_rejected_and_no_categories" }, { status: 400 });
  }

  const categoryValues = categories ?? [];
  await prisma.subscriberCategory.deleteMany({ where: { subscriberId: subscriber.id } });
  await prisma.subscriberCategory.createMany({
    data: categoryValues.map((category) => ({ subscriberId: subscriber.id, category: category as Category }))
  });
  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { interestText: interest.interestText, interestEmbedding: interest.interestEmbedding }
  });

  return Response.json({ ok: true, interestRejected: interest.rejected });
}
