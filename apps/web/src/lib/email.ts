import { Resend } from "resend";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Same brand mark used in the daily digest (apps/worker/src/renderDigest.ts) —
// duplicated rather than shared because the web app and worker are separate
// deployables with no shared HTML-email package between them.
const LOGO_MARK = `<svg width="26" height="17" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye'nin Gazetesi">
  <path d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z" fill="#c9862c"/>
  <path d="M13 12C13 6 17 2 22 1L23 3.2C19.5 4.3 17.5 6.7 17.3 9.5C18 9.1 18.8 9 19.6 9.2C21.3 9.6 22.3 11 22 12.7C21.7 14.4 20.1 15.5 18.3 15.2C15.6 14.7 13.3 14.3 13 12Z" fill="#c9862c"/>
</svg>`;

export async function sendWelcomeEmail(to: string, preferencesToken: string): Promise<void> {
  const baseUrl = process.env.BASE_URL;
  const preferencesUrl = `${baseUrl}/preferences?token=${preferencesToken}`;

  await getClient().emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: "Türkiye'nin Gazetesi'ne hoş geldin",
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding-right:8px;vertical-align:middle;">${LOGO_MARK}</td>
          <td style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:20px;color:#1b2430;vertical-align:middle;">Türkiye'nin Gazetesi</td>
        </tr>
      </table>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Türkiye'nin Gazetesi'ne hoş geldin.</p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Bugünden itibaren, seçtiğin kategorilerdeki günün önemli haberlerini her sabah saat 09:00'da kısa ve öz özetlerle kutunda bulacaksın. Okuman gereken her şey, gereksiz hiçbir şey olmadan.</p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Aklın değişirse, tercihlerini istediğin an <a href="${preferencesUrl}" style="color:#4a3311;font-weight:600;">buradan</a> güncelleyebilirsin.</p>
    `
  });
}
