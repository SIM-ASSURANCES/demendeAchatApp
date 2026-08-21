import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, messageErreur } from "../lib/api";

export function SuiviEntryPage() {
  const [numero, setNumero] = useState("");
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const { data } = await api.get<{ lienSuiviToken: string }>("/demandes/rechercher", {
        params: { numero: numero.trim(), email: email.trim() },
      });
      navigate(`/suivi/${data.lienSuiviToken}`);
    } catch (err) {
      setErreur(messageErreur(err, "Aucune demande ne correspond à ce numéro et cet email."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-[#004B9C]">Suivre ma demande</h1>
      <p className="mt-1 text-sm text-gray-600">
        Saisissez le numéro de votre demande (reçu par email à la soumission, ex. DA-2026-00001)
        ainsi que l'email utilisé, pour accéder à son suivi (F-08).
      </p>
      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Numéro de la demande</span>
          <input
            className="champ"
            placeholder="DA-2026-00001"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Email du demandeur</span>
          <input
            className="champ"
            type="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded bg-[#004B9C] py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? "Recherche…" : "Accéder à ma demande"}
        </button>
      </form>
    </div>
  );
}
