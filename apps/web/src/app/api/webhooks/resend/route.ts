import { Webhook } from "svix";
import { prisma } from "@gazete/db";

interface ResendWebhookEvent {
  type: string;
  data: {
    to: string[];
    bounce?: { type?: string; subType?: string };
  };
}

/**
 * Only a permanent (hard) bounce means the address is genuinely dead. Transient
 * bounces — full mailbox, greylisting, temporary outage — must not unsubscribe
 * anyone. Resend nests the classification under `data.bounce.type`; if it is
 * missing or unrecognised we treat it as NOT permanent, so an ambiguous payload
 * never costs a real subscriber their subscription.
 */
function isPermanentBounce(event: ResendWebhookEvent): boolean {
  return event.data.bounce?.type?.toLowerCase() === "permanent";
}

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? ""
  };

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET as string);
  let event: ResendWebhookEvent;
  try {
    event = wh.verify(payload, headers) as ResendWebhookEvent;
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "email.bounced" && isPermanentBounce(event)) {
    const [email] = event.data.to;
    await prisma.subscriber.updateMany({
      where: { email },
      data: { status: "unsubscribed" }
    });
  }

  return Response.json({ ok: true });
}
