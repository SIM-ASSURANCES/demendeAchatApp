import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, messageErreur } from "../lib/api";

const ligneSchema = z.object({
  libelle: z.string().min(1, "Libellé requis"),
  quantite: z.coerce.number().positive("Quantité invalide"),
  prixUnitaire: z.coerce.number().nonnegative("Prix invalide"),
});

const formSchema = z
  .object({
    demandeurNom: z.string().min(1, "Nom requis"),
    demandeurFonction: z.string().optional(),
    demandeurEmail: z.string().email("Email invalide"),
    demandeurTelephone: z.string().optional(),
    entiteId: z.string().min(1, "Entité requise"),
    categorieId: z.string().min(1, "Catégorie requise"),
    budgetId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
    motif: z.string().min(1, "Motif requis"),
    dateLivraisonSouhaitee: z.string().min(1, "Date requise"),
    devise: z.enum(["XOF", "USD", "EUR"]),
    tauxChange: z.coerce.number().positive("Taux de change invalide").optional(),
    lignes: z.array(ligneSchema).min(1, "Ajoutez au moins un article"),
  })
  // F-15 : taux de change de référence obligatoire pour toute devise autre que le XOF.
  .refine((d) => d.devise === "XOF" || d.tauxChange !== undefined, {
    message: "Taux de change requis pour cette devise",
    path: ["tauxChange"],
  });

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

interface Reference {
  id: string;
  libelle: string;
}

interface PosteBudgetaire {
  id: string;
  poste: string;
  entiteId: string;
  categorieId: string;
}

export function PublicFormPage() {
  const [resultat, setResultat] = useState<{ numero: string; lienSuiviToken: string } | null>(null);

  const entites = useQuery({
    queryKey: ["entites"],
    queryFn: async () => (await api.get<Reference[]>("/entites")).data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Reference[]>("/categories")).data,
  });
  const postesBudgetaires = useQuery({
    queryKey: ["budgets-postes"],
    queryFn: async () => (await api.get<PosteBudgetaire[]>("/budgets/postes")).data,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { devise: "XOF", lignes: [{ libelle: "", quantite: 1, prixUnitaire: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lignes" });
  const lignes = watch("lignes");
  const entiteChoisie = watch("entiteId");
  const categorieChoisie = watch("categorieId");
  const deviseChoisie = watch("devise");
  const totalGeneral = (lignes ?? []).reduce(
    (somme, l) => somme + (Number(l?.quantite) || 0) * (Number(l?.prixUnitaire) || 0),
    0
  );

  // Ne proposer que les postes budgétaires cohérents avec l'entité et la catégorie déjà choisies.
  const postesEligibles = (postesBudgetaires.data ?? []).filter(
    (p) => (!entiteChoisie || p.entiteId === entiteChoisie) && (!categorieChoisie || p.categorieId === categorieChoisie)
  );

  const soumission = useMutation({
    mutationFn: async (values: FormOutput) =>
      (await api.post("/demandes", values)).data as { numero: string; lienSuiviToken: string },
    onSuccess: (data) => setResultat(data),
  });

  if (resultat) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-emerald-800">Demande envoyée</h1>
        <p className="mt-2 text-emerald-900">
          Votre demande a été enregistrée sous le numéro <strong>{resultat.numero}</strong>.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Un accusé de réception a été envoyé à votre adresse email avec un lien de suivi personnel.
        </p>
        <Link
          to={`/suivi/${resultat.lienSuiviToken}`}
          className="mt-4 inline-block rounded bg-[#004B9C] px-4 py-2 text-white hover:opacity-90"
        >
          Suivre ma demande maintenant
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => soumission.mutate(values))}
      className="mx-auto max-w-3xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-[#004B9C]">Demande d'achat</h1>
        <p className="text-sm text-gray-600">
          Formulaire public — aucune authentification n'est requise pour soumettre une demande (F-01).
        </p>
      </div>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Vos coordonnées</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Nom et prénom" erreur={errors.demandeurNom?.message}>
            <input className="champ" {...register("demandeurNom")} />
          </Champ>
          <Champ label="Fonction" erreur={errors.demandeurFonction?.message}>
            <input className="champ" {...register("demandeurFonction")} />
          </Champ>
          <Champ label="Email" erreur={errors.demandeurEmail?.message}>
            <input className="champ" type="email" {...register("demandeurEmail")} />
          </Champ>
          <Champ label="Téléphone" erreur={errors.demandeurTelephone?.message}>
            <input className="champ" {...register("demandeurTelephone")} />
          </Champ>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">En-tête de la demande</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Entité bénéficiaire" erreur={errors.entiteId?.message}>
            <select className="champ" {...register("entiteId")}>
              <option value="">Sélectionner…</option>
              {entites.data?.map((e) => (
                <option key={e.id} value={e.id}>{e.libelle}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Catégorie d'achat" erreur={errors.categorieId?.message}>
            <select className="champ" {...register("categorieId")}>
              <option value="">Sélectionner…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.libelle}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Date de livraison souhaitée" erreur={errors.dateLivraisonSouhaitee?.message}>
            <input className="champ" type="date" {...register("dateLivraisonSouhaitee")} />
          </Champ>
          <Champ label="Poste budgétaire concerné (facultatif)">
            <select className="champ" {...register("budgetId")}>
              <option value="">Aucun / non déterminé</option>
              {postesEligibles.map((p) => (
                <option key={p.id} value={p.id}>{p.poste}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Devise" erreur={errors.devise?.message}>
            <select className="champ" {...register("devise")}>
              <option value="XOF">Franc CFA (XOF)</option>
              <option value="USD">Dollar américain (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </Champ>
          {deviseChoisie !== "XOF" && (
            <Champ
              label={`Taux de change de référence (1 ${deviseChoisie} = ? XOF)`}
              erreur={errors.tauxChange?.message}
            >
              <input className="champ" type="number" step="0.000001" min="0" {...register("tauxChange")} />
            </Champ>
          )}
        </div>
        <Champ label="Motif de l'achat" erreur={errors.motif?.message}>
          <textarea className="champ" rows={3} {...register("motif")} />
        </Champ>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Tableau des articles</h2>
          <button
            type="button"
            onClick={() => append({ libelle: "", quantite: 1, prixUnitaire: 0 })}
            className="rounded bg-[#004B9C] px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            + Ajouter une ligne
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Libellé</th>
                <th className="py-2 w-24">Nombre</th>
                <th className="py-2 w-32">Prix unitaire</th>
                <th className="py-2 w-32">Total</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const ligne = lignes?.[index];
                const total = (Number(ligne?.quantite) || 0) * (Number(ligne?.prixUnitaire) || 0);
                return (
                  <tr key={field.id} className="border-b">
                    <td className="py-2 pr-2">
                      <input className="champ" {...register(`lignes.${index}.libelle` as const)} />
                    </td>
                    <td className="py-2 pr-2">
                      <input className="champ" type="number" step="0.01" {...register(`lignes.${index}.quantite` as const)} />
                    </td>
                    <td className="py-2 pr-2">
                      <input className="champ" type="number" step="0.01" {...register(`lignes.${index}.prixUnitaire` as const)} />
                    </td>
                    <td className="py-2 pr-2 font-medium">{total.toLocaleString("fr-FR")}</td>
                    <td className="py-2">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-red-600 hover:underline">
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {errors.lignes && <p className="mt-1 text-xs text-red-600">{errors.lignes.message}</p>}
        </div>

        <div className="flex justify-end border-t pt-3">
          <div className="text-right">
            <span className="text-sm text-gray-500">Total général</span>
            <p className="text-xl font-bold text-[#004B9C]">{totalGeneral.toLocaleString("fr-FR")} {deviseChoisie}</p>
          </div>
        </div>
      </section>

      {soumission.isError && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {messageErreur(soumission.error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || soumission.isPending}
        className="w-full rounded bg-[#004B9C] py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {soumission.isPending ? "Envoi en cours…" : "Envoyer la demande"}
      </button>
    </form>
  );
}

function Champ({
  label,
  erreur,
  children,
}: {
  label: string;
  erreur?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {erreur && <span className="mt-1 block text-xs text-red-600">{erreur}</span>}
    </label>
  );
}
