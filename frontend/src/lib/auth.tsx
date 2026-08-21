import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { api, definirAccessToken } from "./api";

export type Role = "RH" | "DG" | "ADMIN";

export interface UtilisateurConnecte {
  id: string;
  nom: string;
  role: Role;
}

interface AuthContextValue {
  utilisateur: UtilisateurConnecte | null;
  chargement: boolean;
  connexion: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<UtilisateurConnecte | null>(null);
  const [chargement, setChargement] = useState(true);

  // Restauration de session au chargement, via le cookie de rafraîchissement (httpOnly).
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        definirAccessToken(data.accessToken);
        const moi = await api.get("/auth/moi");
        if (!annule) setUtilisateur(moi.data);
      } catch {
        definirAccessToken(null);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const connexion = useCallback(async (identifiant: string, motDePasse: string) => {
    const { data } = await api.post("/auth/login", { identifiant, motDePasse });
    definirAccessToken(data.accessToken);
    setUtilisateur(data.utilisateur);
  }, []);

  const deconnexion = useCallback(async () => {
    await api.post("/auth/logout");
    definirAccessToken(null);
    setUtilisateur(null);
  }, []);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  return ctx;
}
