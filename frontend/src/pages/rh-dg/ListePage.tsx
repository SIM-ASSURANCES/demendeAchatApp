import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { StatutBadge } from "../../components/StatutBadge";

interface DemandeListe {
  id: string;
  numero: string;
  statut: string;
  demandeurNom: string;
  motif: string;
  montantTotal: string;
  devise: string;
  creeLe: string;
  entite: { libelle: string };
  categorie: { libelle: string };
}

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "SOUMISE", label: "En attente de validation" },
  { value: "VALIDEE", label: "Validée" },
  { value: "REJETEE", label: "Rejetée" },
  { value: "ANNULEE", label: "Annulée" },
];

export function ListePage() {
  const [statut, setStatut] = useState("");
  const [recherche, setRecherche] = useState("");

  const { data: demandes, isLoading } = useQuery({
    queryKey: ["demandes", statut, recherche],
    queryFn: async () =>
      (
        await api.get<DemandeListe[]>("/demandes", {
          params: { statut: statut || undefined, recherche: recherche || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#004B9C]">Demandes d'achat</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="champ max-w-xs"
          placeholder="Rechercher (numéro, demandeur)…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select className="champ max-w-xs" value={statut} onChange={(e) => setStatut(e.target.value)}>
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2">Numéro</th>
              <th className="px-4 py-2">Demandeur</th>
              <th className="px-4 py-2">Entité</th>
              <th className="px-4 py-2">Catégorie</th>
              <th className="px-4 py-2">Montant</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Chargement…</td></tr>
            )}
            {demandes?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucune demande.</td></tr>
            )}
            {demandes?.map((d) => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link to={`/espace/demandes/${d.id}`} className="font-medium text-[#004B9C] hover:underline">
                    {d.numero}
                  </Link>
                </td>
                <td className="px-4 py-2">{d.demandeurNom}</td>
                <td className="px-4 py-2">{d.entite.libelle}</td>
                <td className="px-4 py-2">{d.categorie.libelle}</td>
                <td className="px-4 py-2">{Number(d.montantTotal).toLocaleString("fr-FR")} {d.devise}</td>
                <td className="px-4 py-2"><StatutBadge statut={d.statut} /></td>
                <td className="px-4 py-2 text-gray-500">{new Date(d.creeLe).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
