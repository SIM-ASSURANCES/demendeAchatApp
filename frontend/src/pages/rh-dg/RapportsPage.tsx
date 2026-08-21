import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Wallet, FileText } from "lucide-react";
import { api } from "../../lib/api";

// Palette catégorielle validée (dataviz skill — références/palette.md), ordre fixe jamais permuté.
const CATEGORIEL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const BLEU_SEQUENTIEL = "#004B9C"; // bleu institutionnel SIM ASSURANCES (Pantone 004B9C)
const GRILLE = "#e1e0d9";
const AXE_MUET = "#898781";
const ENCRE_SECONDAIRE = "#52514e";

const FORMAT_XOF = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const formatterXOF = (valeur: unknown) => `${FORMAT_XOF.format(Number(Array.isArray(valeur) ? valeur[0] : (valeur ?? 0)))} XOF`;

interface Reference {
  id: string;
  libelle: string;
}

interface LigneAgregat {
  id?: string;
  libelle?: string;
  periode?: string;
  total: number;
  nombre: number;
}

interface TableauDeBord {
  totalGeneral: number;
  nombreDemandes: number;
  parCategorie: LigneAgregat[];
  parEntite: LigneAgregat[];
  parPeriode: LigneAgregat[];
}

interface BudgetSuivi {
  id: string;
  poste: string;
  entite: { libelle: string };
  categorie: { libelle: string };
  montantAlloue: number;
  realise: number;
  disponible: number;
  pourcentageConsomme: number;
  alerte: "DEPASSEMENT" | "QUASI_DEPASSEMENT" | null;
}

const GRANULARITES = [
  { value: "jour", label: "Jour" },
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
  { value: "trimestre", label: "Trimestre" },
  { value: "annee", label: "Année" },
  { value: "personnalisee", label: "Période personnalisée" },
];

export function RapportsPage() {
  const [granularite, setGranularite] = useState("mois");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [entiteId, setEntiteId] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [inclureAnnulees, setInclureAnnulees] = useState(false);

  const params = {
    granularite,
    dateDebut: dateDebut || undefined,
    dateFin: dateFin || undefined,
    entiteId: entiteId || undefined,
    categorieId: categorieId || undefined,
    inclureAnnulees: inclureAnnulees || undefined,
  };

  const entites = useQuery({
    queryKey: ["entites", "toutes"],
    queryFn: async () => (await api.get<Reference[]>("/entites?toutes=1")).data,
  });
  const categories = useQuery({
    queryKey: ["categories", "toutes"],
    queryFn: async () => (await api.get<Reference[]>("/categories?toutes=1")).data,
  });
  const tableau = useQuery({
    queryKey: ["rapports", "tableau-bord", params],
    queryFn: async () => (await api.get<TableauDeBord>("/rapports/tableau-bord", { params })).data,
  });
  const budgets = useQuery({
    queryKey: ["rapports", "budgets"],
    queryFn: async () => (await api.get<BudgetSuivi[]>("/rapports/budgets")).data,
  });

  async function exporter(format: "xlsx" | "pdf") {
    const reponse = await api.get(`/rapports/export.${format}`, { params, responseType: "blob" });
    const url = URL.createObjectURL(new Blob([reponse.data]));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `rapport-demandes-achat.${format}`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  }

  const donneesPeriode = (tableau.data?.parPeriode ?? []).map((l) => ({ periode: l.periode, total: l.total }));
  const donneesEntite = (tableau.data?.parEntite ?? []).map((l) => ({ libelle: l.libelle, total: l.total }));
  const donneesCategorie = tableau.data?.parCategorie ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#004B9C]">Rapports et comptabilité</h1>
        <p className="text-sm text-gray-600">
          Demandes validées, ventilées par catégorie, entité et période (F-06). Les demandes annulées sont
          exclues des totaux par défaut (RG-11).
        </p>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Granularité</span>
          <select className="champ" value={granularite} onChange={(e) => setGranularite(e.target.value)}>
            {GRANULARITES.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Du</span>
          <input className="champ" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Au</span>
          <input className="champ" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Entité</span>
          <select className="champ" value={entiteId} onChange={(e) => setEntiteId(e.target.value)}>
            <option value="">Toutes</option>
            {entites.data?.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Catégorie</span>
          <select className="champ" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={inclureAnnulees} onChange={(e) => setInclureAnnulees(e.target.checked)} />
          Inclure les demandes annulées (indicatif)
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => exporter("xlsx")} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Exporter Excel
          </button>
          <button onClick={() => exporter("pdf")} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Exporter PDF
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004B9C]/10 text-[#004B9C]">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Montant total validé</p>
            <p className="mt-0.5 text-2xl font-semibold text-[#004B9C]">
              {FORMAT_XOF.format(tableau.data?.totalGeneral ?? 0)} <span className="text-sm font-normal text-gray-500">XOF</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border bg-white p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#51AEE2]/15 text-[#51AEE2]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Nombre de demandes</p>
            <p className="mt-0.5 text-2xl font-semibold text-[#004B9C]">{tableau.data?.nombreDemandes ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">Évolution par période</h2>
          {donneesPeriode.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Aucune donnée pour cette sélection.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={donneesPeriode} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={GRILLE} />
                <XAxis dataKey="periode" tick={{ fill: AXE_MUET, fontSize: 12 }} axisLine={{ stroke: GRILLE }} tickLine={false} />
                <YAxis tick={{ fill: AXE_MUET, fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={formatterXOF} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Montant validé" fill={BLEU_SEQUENTIEL} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800">Répartition par catégorie</h2>
          {donneesCategorie.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Aucune donnée pour cette sélection.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donneesCategorie}
                  dataKey="total"
                  nameKey="libelle"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {donneesCategorie.map((_, index) => (
                    <Cell key={index} fill={CATEGORIEL[index % CATEGORIEL.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: ENCRE_SECONDAIRE }} />
                <Tooltip formatter={formatterXOF} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">Répartition par entité bénéficiaire</h2>
        {donneesEntite.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Aucune donnée pour cette sélection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, donneesEntite.length * 44)}>
            <BarChart data={donneesEntite} layout="vertical" barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke={GRILLE} />
              <XAxis type="number" tick={{ fill: AXE_MUET, fontSize: 12 }} axisLine={{ stroke: GRILLE }} tickLine={false} />
              <YAxis type="category" dataKey="libelle" tick={{ fill: ENCRE_SECONDAIRE, fontSize: 12 }} axisLine={false} tickLine={false} width={160} />
              <Tooltip formatter={formatterXOF} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Montant validé" fill={BLEU_SEQUENTIEL} radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-800">Suivi budgétaire (Budget / Réalisé / Disponible)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3">Poste</th>
                <th className="py-2 pr-3">Entité</th>
                <th className="py-2 pr-3">Catégorie</th>
                <th className="py-2 pr-3">Alloué</th>
                <th className="py-2 pr-3">Réalisé</th>
                <th className="py-2 pr-3">Disponible</th>
                <th className="py-2 pr-3">Alerte</th>
              </tr>
            </thead>
            <tbody>
              {budgets.data?.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-gray-500">Aucun poste budgétaire paramétré.</td></tr>
              )}
              {budgets.data?.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="py-2 pr-3 font-medium">{b.poste}</td>
                  <td className="py-2 pr-3">{b.entite.libelle}</td>
                  <td className="py-2 pr-3">{b.categorie.libelle}</td>
                  <td className="py-2 pr-3">{FORMAT_XOF.format(b.montantAlloue)}</td>
                  <td className="py-2 pr-3">{FORMAT_XOF.format(b.realise)}</td>
                  <td className={`py-2 pr-3 ${b.disponible < 0 ? "font-semibold text-red-700" : ""}`}>
                    {FORMAT_XOF.format(b.disponible)}
                  </td>
                  <td className="py-2 pr-3">
                    {b.alerte === "DEPASSEMENT" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                        ⚠ Dépassement
                      </span>
                    )}
                    {b.alerte === "QUASI_DEPASSEMENT" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        ⚠ Quasi-dépassement
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
