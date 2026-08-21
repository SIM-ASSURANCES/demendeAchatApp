import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function SuiviEntryPage() {
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-[#004B9C]">Suivre ma demande</h1>
      <p className="mt-1 text-sm text-gray-600">
        Saisissez le lien de suivi personnel reçu par email lors de la soumission (F-08).
      </p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) navigate(`/suivi/${token.trim()}`);
        }}
      >
        <input
          className="champ"
          placeholder="Coller ici le code de suivi"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" className="w-full rounded bg-[#004B9C] py-2.5 font-semibold text-white hover:opacity-90">
          Accéder à ma demande
        </button>
      </form>
    </div>
  );
}
