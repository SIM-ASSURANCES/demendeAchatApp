import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { messageErreur } from "../lib/api";

export function LoginPage() {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await connexion(identifiant, motDePasse);
      navigate("/espace/demandes");
    } catch (err) {
      setErreur(messageErreur(err, "Identifiants invalides."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-[#004B9C]">Connexion</h1>
        <p className="mt-1 text-sm text-gray-600">Espace RH, Direction Générale ou Administration.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Identifiant</span>
            <input className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Mot de passe</span>
            <input
              className="champ"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded bg-[#004B9C] py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {enCours ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
