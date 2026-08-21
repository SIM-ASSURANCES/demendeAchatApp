const STYLES: Record<string, string> = {
  SOUMISE: "bg-amber-100 text-amber-800 border-amber-300",
  EN_ATTENTE_SECONDE_VALIDATION: "bg-sky-100 text-sky-800 border-sky-300",
  REJETEE: "bg-red-100 text-red-800 border-red-300",
  VALIDEE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ANNULEE: "bg-gray-200 text-gray-700 border-gray-300",
};

const LIBELLES: Record<string, string> = {
  SOUMISE: "En attente de validation",
  EN_ATTENTE_SECONDE_VALIDATION: "En attente de la seconde validation",
  REJETEE: "Rejetée",
  VALIDEE: "Validée",
  ANNULEE: "Annulée",
};

export function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        STYLES[statut] ?? "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {LIBELLES[statut] ?? statut}
    </span>
  );
}
