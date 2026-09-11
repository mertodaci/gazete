import { Resend } from "resend";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWelcomeEmail(to: string, preferencesToken: string): Promise<void> {
  const baseUrl = process.env.BASE_URL;
  const preferencesUrl = `${baseUrl}/preferences?token=${preferencesToken}`;
  // Loaded from apps/web/public/logo-mark.svg as an <img> rather than inline
  // <svg> markup — Gmail and several other mail clients strip inline SVG from
  // HTML email as a sanitization step, but an externally-loaded image survives.
  const logoMark = `<img src="${baseUrl}/logo-mark.svg" width="26" height="17" alt="Türkiye'nin Gazetesi" style="display:block;border:0;">`;

  await getClient().emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: "Türkiye'nin Gazetesi'ne hoş geldin",
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding-right:8px;vertical-align:middle;">${logoMark}</td>
          <td style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:20px;color:#1b2430;vertical-align:middle;">Türkiye'nin Gazetesi</td>
        </tr>
      </table>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Türkiye'nin Gazetesi'ne hoş geldin.</p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Bugünden itibaren, seçtiğin kategorilerdeki günün önemli haberlerini her sabah saat 09:00'da kısa ve öz özetlerle kutunda bulacaksın. Okuman gereken her şey, gereksiz hiçbir şey olmadan.</p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b2430;">Aklın değişirse, tercihlerini istediğin an <a href="${preferencesUrl}" style="color:#4a3311;font-weight:600;">buradan</a> güncelleyebilirsin.</p>
    `
  });
}
