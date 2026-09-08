import { Webhook } from "svix";
import { prisma } from "@gazete/db";

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? ""
  };

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET as string);
  let event: { type: string; data: { to: string[] } };
  try {
    event = wh.verify(payload, headers) as typeof event;
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "email.bounced") {
    const [email] = event.data.to;
    await prisma.subscriber.updateMany({
      where: { email },
      data: { status: "unsubscribed" }
    });
  }

  return Response.json({ ok: true });
}
