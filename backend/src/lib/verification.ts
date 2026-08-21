import { createHmac } from "crypto";
import { env } from "../config/env";

// F-07 : code de vérification permettant de contrôler l'authenticité d'une fiche imprimée.
// Dérivé du numéro et du statut de la demande : un document falsifié (statut modifié, numéro
// changé) ne produit plus le même code, sans exposer d'information sur la base de données.
export function genererCodeVerification(numero: string, statut: string): string {
  return createHmac("sha256", env.verificationSecret)
    .update(`${numero}|${statut}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

export function verifierCode(numero: string, statut: string, code: string): boolean {
  return genererCodeVerification(numero, statut) === code.toUpperCase();
}

export function urlVerification(numero: string, statut: string, frontendUrl: string): string {
  const code = genererCodeVerification(numero, statut);
  return `${frontendUrl}/verification/${encodeURIComponent(numero)}?code=${code}`;
}
