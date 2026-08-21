import nodemailer from "nodemailer";
import { env } from "../config/env";

// En l'absence de SMTP configuré (environnement de développement), les emails sont sérialisés
// sans envoi réseau réel (jsonTransport) et journalisés en console — ceci permet de développer et
// de tester F-09 sans dépendre d'un fournisseur SMTP, sans jamais faire échouer le flux applicatif.
const transporteur = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export interface EmailAEnvoyer {
  to: string;
  subject: string;
  html: string;
}

// Un échec d'envoi ne doit jamais interrompre le flux métier (soumission, validation, etc.) —
// l'erreur est journalisée, jamais propagée.
export async function envoyerEmail(email: EmailAEnvoyer): Promise<void> {
  try {
    await transporteur.sendMail({ from: env.smtp.from, to: email.to, subject: email.subject, html: email.html });
    if (!env.smtp.host) {
      console.log(`[email:dev] À ${email.to} — ${email.subject}`);
    }
  } catch (err) {
    console.error(`Échec d'envoi d'email à ${email.to} (${email.subject}) :`, err);
  }
}

export async function envoyerEmails(emails: EmailAEnvoyer[]): Promise<void> {
  await Promise.allSettled(emails.map(envoyerEmail));
}
