import { Resend } from "resend";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWelcomeEmail(to: string, preferencesToken: string): Promise<void> {
  const baseUrl = process.env.BASE_URL;
  const preferencesUrl = `${baseUrl}/preferences?token=${preferencesToken}`;

  await getClient().emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: "Gazete'ye hoş geldin",
    html: `
      <p>Gazete'ye abone oldun. Her sabah 09:00'da seçtiğin kategorilerden bir bülten alacaksın.</p>
      <p>Tercihlerini istediğin zaman <a href="${preferencesUrl}">buradan</a> güncelleyebilirsin.</p>
    `
  });
}
