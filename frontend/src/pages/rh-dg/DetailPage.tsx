import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, messageErreur } from "../../lib/api";
import { StatutBadge } from "../../components/StatutBadge";
import { ouvrirPdfAuthentifie } from "../../lib/ouvrirFichier";

interface Detail {
  id: string;
  numero: string;
  statut: string;
  demandeurNom: string;
  demandeurEmail: string;
  demandeurTelephone?: string | null;
  motif: string;
  montantTotal: string;
  devise: string;
  dateLivraisonSouhaitee: string;
  motifRejet?: string | null;
  lignes: { id: string; libelle: string; quantite: string; prixUnitaire: string; total: string }[];
  entite: { libelle: string };
  categorie: { libelle: string };
  signatures: { role: string; nom: string; horodatage: string }[];
  piecesJointes: { id: string; nomFichier: string; typeDocument: string }[];
}

export function DetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [motifRejet, setMotifRejet] = useState("");
  const [afficherRejet, setAfficherRejet] = useState(false);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [commentaireAnnulation, setCommentaireAnnulation] = useState("");
  const [afficherAnnulation, setAfficherAnnulation] = useState(false);

  const { data: demande, isLoading } = useQuery({
    queryKey: ["demande", id],
    queryFn: async () => (await api.get<Detail>(`/demandes/${id}`)).data,
  });

  function invalider() {
    queryClient.invalidateQueries({ queryKey: ["demande", id] });
    queryClient.invalidateQueries({ queryKey: ["demandes"] });
  }

  const valider = useMutation({
    mutationFn: async () => api.post(`/demandes/${id}/valider`),
    onSuccess: invalider,
  });

  const rejeter = useMutation({
    mutationFn: async () => api.post(`/demandes/${id}/rejeter`, { motif: motifRejet }),
    onSuccess: () => {
      setAfficherRejet(false);
      invalider();
    },
  });

  const annuler = useMutation({
    mutationFn: async () =>
      api.post(`/demandes/${id}/annuler`, { categorie: motifAnnulation, commentaire: commentaireAnnulation }),
    onSuccess: () => {
      setAfficherAnnulation(false);
      invalider();
    },
  });

  if (isLoading) return <p className="text-center text-gray-500">Chargement…</p>;
  if (!demande) return <p className="text-center text-red-600">Demande introuvable.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-[#004B9C] hover:underline">← Retour à la liste</button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#004B9C]">Demande {demande.numero}</h1>
          <p className="text-sm text-gray-600">
            {demande.demandeurNom} — {demande.demandeurEmail} {demande.demandeurTelephone ? `— ${demande.demandeurTelephone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatutBadge statut={demande.statut} />
          <button
            onClick={() => ouvrirPdfAuthentifie(`/demandes/${demande.id}/fiche.pdf`)}
            className="rounded border border-[#004B9C] px-3 py-1.5 text-sm font-medium text-[#004B9C] hover:bg-[#004B9C]/5"
          >
            Fiche officielle (PDF)
          </button>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Entité bénéficiaire</dt><dd>{demande.entite.libelle}</dd></div>
          <div><dt className="text-gray-500">Catégorie</dt><dd>{demande.categorie.libelle}</dd></div>
          <div><dt className="text-gray-500">Date de livraison souhaitée</dt><dd>{new Date(demande.dateLivraisonSouhaitee).toLocaleDateString("fr-FR")}</dd></div>
          <div><dt className="text-gray-500">Montant total</dt><dd className="font-semibold">{Number(demande.montantTotal).toLocaleString("fr-FR")} {demande.devise}</dd></div>
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

      {demande.piecesJointes.length > 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">Pièces justificatives</h2>
          <ul className="list-inside list-disc text-sm">
            {demande.piecesJointes.map((p) => (
              <li key={p.id}>{p.nomFichier} <span className="text-gray-500">({p.typeDocument})</span></li>
            ))}
          </ul>
        </section>
      )}

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

      {demande.statut === "SOUMISE" && (
        <section className="rounded-lg border border-[#004B9C]/20 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => valider.mutate()}
              disabled={valider.isPending}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Valider
            </button>
            <button
              onClick={() => setAfficherRejet((v) => !v)}
              className="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Rejeter
            </button>
          </div>

          {valider.isError && <p className="text-sm text-red-600">{messageErreur(valider.error)}</p>}

          {afficherRejet && (
            <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3">
              <textarea
                className="champ"
                rows={2}
                placeholder="Motif du rejet (obligatoire)"
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
              />
              {rejeter.isError && <p className="text-sm text-red-600">{messageErreur(rejeter.error)}</p>}
              <button
                onClick={() => rejeter.mutate()}
                disabled={!motifRejet.trim() || rejeter.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Confirmer le rejet
              </button>
            </div>
          )}
        </section>
      )}

      {demande.statut === "VALIDEE" && (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Annulation (sans suppression)</h2>
          {!afficherAnnulation ? (
            <button
              onClick={() => setAfficherAnnulation(true)}
              className="rounded border border-gray-400 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Annuler cette demande
            </button>
          ) : (
            <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
              <select className="champ" value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}>
                <option value="">Catégorie de motif…</option>
                <option value="Achat non réalisé">Achat non réalisé</option>
                <option value="Erreur de saisie">Erreur de saisie</option>
                <option value="Budget devenu indisponible">Budget devenu indisponible</option>
                <option value="Autre">Autre</option>
              </select>
              <textarea
                className="champ"
                rows={2}
                placeholder="Commentaire libre"
                value={commentaireAnnulation}
                onChange={(e) => setCommentaireAnnulation(e.target.value)}
              />
              {annuler.isError && <p className="text-sm text-red-600">{messageErreur(annuler.error)}</p>}
              <button
                onClick={() => annuler.mutate()}
                disabled={!motifAnnulation || annuler.isPending}
                className="rounded bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Confirmer l'annulation
              </button>
            </div>
          )}
        </section>
      )}

      {demande.statut === "REJETEE" && demande.motifRejet && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Motif du rejet :</strong> {demande.motifRejet}
        </div>
      )}
    </div>
  );
}
