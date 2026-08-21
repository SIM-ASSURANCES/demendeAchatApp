import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  nom: string;
}

export async function verifierIdentifiants(identifiant: string, motDePasse: string) {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { identifiant } });
  if (!utilisateur || !utilisateur.actif) return null;

  const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.motDePasseHash);
  if (!motDePasseValide) return null;

  return utilisateur;
}

export function genererAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpires as any });
}

export function genererRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpires as any });
}

export function verifierRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, 12);
}
