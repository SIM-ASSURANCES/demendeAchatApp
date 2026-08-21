import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, messageErreur } from "../lib/api";
import { StatutBadge } from "../components/StatutBadge";

interface LigneArticle {
  id: string;
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  total: string;
}

interface Demande {
  id: string;
  numero: string;
  statut: string;
  demandeurNom: string;
  motif: string;
  montantTotal: string;
  dateLivraisonSouhaitee: string;
  motifRejet?: string | null;
  motifAnnulationCommentaire?: string | null;
  lignes: LigneArticle[];
  entite: { libelle: string };
  categorie: { libelle: string };
  signatures: { role: string; nom: string; horodatage: string }[];
}

export function SuiviPage() {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();

  const { data: demande, isLoading, isError } = useQuery({
    queryKey: ["suivi", token],
    queryFn: async () => (await api.get<Demande>(`/demandes/suivi/${token}`)).data,
  });

  const suppression = useMutation({
    mutationFn: async () => api.delete(`/demandes/suivi/${token}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suivi", token] }),
  });

  if (isLoading) return <p className="text-center text-gray-500">Chargement…</p>;
  if (isError || !demande) return <p className="text-center text-red-600">Demande introuvable pour ce lien de suivi.</p>;

  const modifiable = demande.statut === "SOUMISE";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#004B9C]">Demande {demande.numero}</h1>
          <p className="text-sm text-gray-600">Demandeur : {demande.demandeurNom}</p>
        </div>
        <StatutBadge statut={demande.statut} />
      </div>

      {demande.statut === "REJETEE" && demande.motifRejet && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Motif du rejet :</strong> {demande.motifRejet}
        </div>
      )}
      {demande.statut === "ANNULEE" && demande.motifAnnulationCommentaire && (
        <div className="rounded border border-gray-300 bg-gray-100 p-3 text-sm text-gray-700">
          <strong>Motif de l'annulation :</strong> {demande.motifAnnulationCommentaire}
        </div>
      )}

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">Détail de la demande</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Entité bénéficiaire</dt><dd>{demande.entite.libelle}</dd></div>
          <div><dt className="text-gray-500">Catégorie</dt><dd>{demande.categorie.libelle}</dd></div>
          <div><dt className="text-gray-500">Date de livraison souhaitée</dt><dd>{new Date(demande.dateLivraisonSouhaitee).toLocaleDateString("fr-FR")}</dd></div>
          <div><dt className="text-gray-500">Montant total</dt><dd className="font-semibold">{Number(demande.montantTotal).toLocaleString("fr-FR")} XOF</dd></div>
        </dl>
        <p className="mt-3 text-sm"><span className="text-gray-500">Motif :</span> {demande.motif}</p>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">Articles</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1">Libellé</th><th className="py-1">Qté</th><th className="py-1">P.U.</th><th className="py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {demande.lignes.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-1">{l.libelle}</td>
                <td className="py-1">{l.quantite}</td>
                <td className="py-1">{Number(l.prixUnitaire).toLocaleString("fr-FR")}</td>
                <td className="py-1">{Number(l.total).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">Cases de signature</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {["DEMANDEUR", "RH", "DG"].map((role) => {
            const signature = demande.signatures.find((s) => s.role === role);
            return (
              <div key={role} className="rounded border p-3 text-center text-sm">
                <p className="text-gray-500">{role === "DEMANDEUR" ? "Demandeur" : role}</p>
                {signature ? (
                  <>
                    <p className="font-medium">{signature.nom}</p>
                    <p className="text-xs text-gray-500">{new Date(signature.horodatage).toLocaleString("fr-FR")}</p>
                  </>
                ) : (
                  <p className="text-gray-400 italic">En attente</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {modifiable && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            Votre demande n'a pas encore été traitée : elle peut encore être supprimée (RG-03). La modification des
            lignes se fait en resoumettant une nouvelle demande le cas échéant.
          </p>
          {suppression.isError && (
            <p className="mt-2 text-sm text-red-700">{messageErreur(suppression.error)}</p>
          )}
          <button
            onClick={() => {
              if (confirm("Confirmez-vous la suppression définitive de cette demande ?")) {
                suppression.mutate();
              }
            }}
            className="mt-3 rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Supprimer la demande
          </button>
        </section>
      )}

      {demande.statut === "VALIDEE" && (
        <p className="text-center text-sm text-gray-500">
          Cette demande est verrouillée : plus aucune modification n'est possible (F-04).
        </p>
      )}
    </div>
  );
}
