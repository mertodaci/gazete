import { prisma } from "@gazete/db";

export async function POST(request: Request): Promise<Response> {
  const { token } = (await request.json()) as { token?: string };
  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

  const subscriber = await prisma.subscriber.findUnique({ where: { preferencesToken: token } });
  if (!subscriber) return Response.json({ error: "not_found" }, { status: 404 });

  await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: "unsubscribed" } });

  return Response.json({ ok: true });
}
