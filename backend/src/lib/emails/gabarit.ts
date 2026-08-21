const NAVY = "#004B9C";

// Gabarit HTML commun à tous les emails F-09, aux couleurs de la charte graphique SIM ASSURANCES.
export function gabaritEmail(titre: string, corpsHtml: string, boutonHref?: string, boutonLibelle?: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${NAVY};padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">SIM ASSURANCES</span>
                <div style="color:#ffffffb3;font-size:11px;margin-top:2px;">SOCIÉTÉ IVOIRIENNE DE MICRO-ASSURANCES</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#111827;">${titre}</h1>
                <div style="font-size:14px;line-height:1.6;color:#374151;">${corpsHtml}</div>
                ${
                  boutonHref
                    ? `<div style="margin-top:24px;">
                        <a href="${boutonHref}" style="background-color:${NAVY};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">${boutonLibelle ?? "Consulter"}</a>
                      </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f4f6f9;font-size:11px;color:#9ca3af;">
                Notification automatique — Application de gestion des demandes d'achat SIM ASSURANCES.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
