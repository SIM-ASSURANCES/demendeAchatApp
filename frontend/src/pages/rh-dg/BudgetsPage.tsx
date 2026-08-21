import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, messageErreur } from "../../lib/api";
import { useAuth } from "../../lib/auth";

interface Reference {
  id: string;
  libelle: string;
}

interface Acteur {
  id: string;
  nom: string;
}

interface Budget {
  id: string;
  poste: string;
  entite: { id: string; libelle: string };
  categorie: { id: string; libelle: string };
  periodeDebut: string;
  periodeFin: string;
  montantAlloue: number;
  devise: string;
  realise: number;
  disponible: number;
  statut: "EN_ATTENTE_VALIDATION" | "VALIDE" | "REJETE";
  proposePar: Acteur | null;
  validePar: Acteur | null;
  rejetePar: Acteur | null;
  motifRejet: string | null;
}

const FORMAT_MONTANT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const STYLES_STATUT: Record<Budget["statut"], string> = {
  EN_ATTENTE_VALIDATION: "bg-amber-100 text-amber-800 border-amber-300",
  VALIDE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJETE: "bg-red-100 text-red-800 border-red-300",
};
const LIBELLES_STATUT: Record<Budget["statut"], string> = {
  EN_ATTENTE_VALIDATION: "En attente de validation DG",
  VALIDE: "Validé",
  REJETE: "Rejeté",
};

function BadgeStatut({ statut }: { statut: Budget["statut"] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES_STATUT[statut]}`}>
      {LIBELLES_STATUT[statut]}
    </span>
  );
}

export function BudgetsPage() {
  const { utilisateur } = useAuth();
  const queryClient = useQueryClient();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [motifsRejet, setMotifsRejet] = useState<Record<string, string>>({});
  const [afficherRejet, setAfficherRejet] = useState<string | null>(null);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get<Budget[]>("/budgets")).data,
  });

  function invalider() {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-compteur"] });
  }

  const valider = useMutation({
    mutationFn: async (id: string) => api.post(`/budgets/${id}/valider`),
    onSuccess: invalider,
  });

  const rejeter = useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string }) => api.post(`/budgets/${id}/rejeter`, { motif }),
    onSuccess: () => {
      setAfficherRejet(null);
      invalider();
    },
  });

  const estRH = utilisateur?.role === "RH";
  const estDG = utilisateur?.role === "DG";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#004B9C]">Postes budgétaires</h1>
          <p className="text-sm text-gray-600">
            Paramétrage proposé par le RH, validé par la Direction Générale.
          </p>
        </div>
        {estRH && (
          <button
            onClick={() => setAfficherFormulaire((v) => !v)}
            className="rounded bg-[#004B9C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {afficherFormulaire ? "Annuler" : "+ Proposer un budget"}
          </button>
        )}
      </div>

      {afficherFormulaire && estRH && <FormulaireProposition onCreated={() => { setAfficherFormulaire(false); invalider(); }} />}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2">Poste</th>
              <th className="px-4 py-2">Entité</th>
              <th className="px-4 py-2">Catégorie</th>
              <th className="px-4 py-2">Alloué</th>
              <th className="px-4 py-2">Réalisé</th>
              <th className="px-4 py-2">Disponible</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Proposé par</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Chargement…</td></tr>
            )}
            {budgets?.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Aucun poste budgétaire.</td></tr>
            )}
            {budgets?.map((b) => (
              <tr key={b.id} className="border-b align-top">
                <td className="px-4 py-2 font-medium">{b.poste}</td>
                <td className="px-4 py-2">{b.entite.libelle}</td>
                <td className="px-4 py-2">{b.categorie.libelle}</td>
                <td className="px-4 py-2">{FORMAT_MONTANT.format(b.montantAlloue)} {b.devise}</td>
                <td className="px-4 py-2">{b.statut === "VALIDE" ? `${FORMAT_MONTANT.format(b.realise)} ${b.devise}` : "—"}</td>
                <td className={`px-4 py-2 ${b.statut === "VALIDE" && b.disponible < 0 ? "font-semibold text-red-700" : ""}`}>
                  {b.statut === "VALIDE" ? `${FORMAT_MONTANT.format(b.disponible)} ${b.devise}` : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    <BadgeStatut statut={b.statut} />
                    {b.statut === "REJETE" && b.motifRejet && (
                      <p className="text-xs text-gray-500">Motif : {b.motifRejet}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">{b.proposePar?.nom ?? "—"}</td>
                <td className="px-4 py-2">
                  {estDG && b.statut === "EN_ATTENTE_VALIDATION" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => valider.mutate(b.id)}
                          disabled={valider.isPending}
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => setAfficherRejet(afficherRejet === b.id ? null : b.id)}
                          className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Rejeter
                        </button>
                      </div>
                      {afficherRejet === b.id && (
                        <div className="w-56 space-y-1.5 rounded border border-red-200 bg-red-50 p-2">
                          <textarea
                            className="champ text-xs"
                            rows={2}
                            placeholder="Motif du rejet"
                            value={motifsRejet[b.id] ?? ""}
                            onChange={(e) => setMotifsRejet((m) => ({ ...m, [b.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => rejeter.mutate({ id: b.id, motif: motifsRejet[b.id] ?? "" })}
                            disabled={!motifsRejet[b.id]?.trim() || rejeter.isPending}
                            className="w-full rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Confirmer le rejet
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormulaireProposition({ onCreated }: { onCreated: () => void }) {
  const [poste, setPoste] = useState("");
  const [entiteId, setEntiteId] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [montantAlloue, setMontantAlloue] = useState("");
  const [devise, setDevise] = useState("XOF");
  const [observations, setObservations] = useState("");

  const entites = useQuery({
    queryKey: ["entites"],
    queryFn: async () => (await api.get<Reference[]>("/entites")).data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Reference[]>("/categories")).data,
  });

  const proposer = useMutation({
    mutationFn: async () =>
      api.post("/budgets", { poste, entiteId, categorieId, periodeDebut, periodeFin, montantAlloue, devise, observations: observations || undefined }),
    onSuccess: onCreated,
  });

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-5 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        proposer.mutate();
      }}
    >
      <input className="champ" placeholder="Nom du poste budgétaire" value={poste} onChange={(e) => setPoste(e.target.value)} required />
      <select className="champ" value={entiteId} onChange={(e) => setEntiteId(e.target.value)} required>
        <option value="">Entité bénéficiaire…</option>
        {entites.data?.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
      </select>
      <select className="champ" value={categorieId} onChange={(e) => setCategorieId(e.target.value)} required>
        <option value="">Catégorie d'achat…</option>
        {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
      </select>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Période — début</span>
        <input className="champ" type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} required />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Période — fin</span>
        <input className="champ" type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} required />
      </label>
      <div className="flex gap-2">
        <input
          className="champ"
          type="number"
          min="0"
          step="0.01"
          placeholder="Montant alloué"
          value={montantAlloue}
          onChange={(e) => setMontantAlloue(e.target.value)}
          required
        />
        <select className="champ w-28" value={devise} onChange={(e) => setDevise(e.target.value)}>
          <option value="XOF">XOF</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <input
        className="champ sm:col-span-3"
        placeholder="Observations (facultatif)"
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
      />
      <div className="sm:col-span-3">
        {proposer.isError && <p className="mb-2 text-sm text-red-600">{messageErreur(proposer.error)}</p>}
        <button
          type="submit"
          disabled={proposer.isPending}
          className="rounded bg-[#004B9C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Soumettre à la Direction Générale
        </button>
      </div>
    </form>
  );
}
