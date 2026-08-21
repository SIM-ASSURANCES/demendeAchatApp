import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { StatutBadge } from "../components/StatutBadge";

interface ResultatVerification {
  valide: boolean;
  numero?: string;
  statut?: string;
  montantTotal?: string;
  entite?: string;
  valideLe?: string | null;
  message?: string;
}

// F-07 : page ouverte en scannant le QR code imprimé sur la fiche officielle, pour en vérifier
// l'authenticité (numéro, statut et montant recalculés côté serveur à partir du code).
export function VerificationPage() {
  const { numero = "" } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["verification", numero, code],
    queryFn: async () => {
      try {
        const { data } = await api.get<ResultatVerification>(`/demandes/verifier/${numero}`, { params: { code } });
        return data;
      } catch {
        return { valide: false, message: "Document non reconnu ou code de vérification invalide." };
      }
    },
  });

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-xl font-bold text-[#004B9C]">Vérification d'authenticité</h1>
      <p className="mt-1 text-sm text-gray-600">Fiche de demande d'achat SIM ASSURANCES</p>

      {isLoading && <p className="mt-8 text-gray-500">Vérification en cours…</p>}

      {!isLoading && data && !data.valide && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <XCircle className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 font-semibold text-red-800">Document non authentifié</p>
          <p className="mt-1 text-sm text-red-700">{data.message ?? "Ce document ne correspond à aucune demande valide."}</p>
        </div>
      )}

      {!isLoading && data?.valide && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
            <p className="font-semibold text-emerald-800">Document authentique</p>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Numéro</dt>
              <dd className="font-medium">{data.numero}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Statut</dt>
              <dd><StatutBadge statut={data.statut ?? ""} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Entité bénéficiaire</dt>
              <dd className="font-medium">{data.entite}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Montant total</dt>
              <dd className="font-medium">{Number(data.montantTotal).toLocaleString("fr-FR")} XOF</dd>
            </div>
            {data.valideLe && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Validée le</dt>
                <dd className="font-medium">{new Date(data.valideLe).toLocaleString("fr-FR")}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
