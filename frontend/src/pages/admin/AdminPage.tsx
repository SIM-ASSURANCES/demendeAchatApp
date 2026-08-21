import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, messageErreur } from "../../lib/api";

interface Reference {
  id: string;
  libelle: string;
  actif: boolean;
}

interface Utilisateur {
  id: string;
  nom: string;
  identifiant: string;
  role: "RH" | "DG" | "ADMIN";
  actif: boolean;
}

const ONGLETS = ["Catégories", "Entités", "Comptes"] as const;

export function AdminPage() {
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]>("Catégories");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#004B9C]">Administration</h1>

      <div className="flex gap-2 border-b">
        {ONGLETS.map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`px-4 py-2 text-sm font-medium ${
              onglet === o ? "border-b-2 border-[#004B9C] text-[#004B9C]" : "text-gray-500"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {onglet === "Catégories" && <ReferenceAdmin ressource="categories" libellePluriel="catégories" />}
      {onglet === "Entités" && <ReferenceAdmin ressource="entites" libellePluriel="entités" />}
      {onglet === "Comptes" && <ComptesAdmin />}
    </div>
  );
}

function ReferenceAdmin({ ressource, libellePluriel }: { ressource: "categories" | "entites"; libellePluriel: string }) {
  const queryClient = useQueryClient();
  const [nouveauLibelle, setNouveauLibelle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: [ressource, "toutes"],
    queryFn: async () => (await api.get<Reference[]>(`/${ressource}?toutes=1`)).data,
  });

  const creer = useMutation({
    mutationFn: async () => api.post(`/${ressource}`, { libelle: nouveauLibelle }),
    onSuccess: () => {
      setNouveauLibelle("");
      queryClient.invalidateQueries({ queryKey: [ressource, "toutes"] });
    },
  });

  const basculerActif = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) =>
      api.patch(`/${ressource}/${id}`, { actif }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ressource, "toutes"] }),
  });

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nouveauLibelle.trim()) creer.mutate();
        }}
      >
        <input
          className="champ"
          placeholder={`Nouvelle catégorie parmi les ${libellePluriel}`}
          value={nouveauLibelle}
          onChange={(e) => setNouveauLibelle(e.target.value)}
        />
        <button className="rounded bg-[#004B9C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Ajouter</button>
      </form>
      {creer.isError && <p className="text-sm text-red-600">{messageErreur(creer.error)}</p>}

      {isLoading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Libellé</th><th className="py-2 w-24">Statut</th><th className="py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.libelle}</td>
                <td className="py-2">{item.actif ? "Actif" : "Désactivé"}</td>
                <td className="py-2">
                  <button
                    onClick={() => basculerActif.mutate({ id: item.id, actif: !item.actif })}
                    className="text-sm text-[#004B9C] hover:underline"
                  >
                    {item.actif ? "Désactiver" : "Réactiver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ComptesAdmin() {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState<"RH" | "DG" | "ADMIN">("RH");

  const { data, isLoading } = useQuery({
    queryKey: ["utilisateurs"],
    queryFn: async () => (await api.get<Utilisateur[]>("/utilisateurs")).data,
  });

  const creer = useMutation({
    mutationFn: async () => api.post("/utilisateurs", { nom, identifiant, motDePasse, role }),
    onSuccess: () => {
      setNom("");
      setIdentifiant("");
      setMotDePasse("");
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
    },
  });

  const desactiver = useMutation({
    mutationFn: async (id: string) => api.patch(`/utilisateurs/${id}/desactiver`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utilisateurs"] }),
  });

  return (
    <div className="space-y-4">
      <form
        className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-5 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          creer.mutate();
        }}
      >
        <input className="champ" placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <input className="champ" placeholder="Identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required />
        <input
          className="champ"
          placeholder="Mot de passe (12+ caractères)"
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
        />
        <select className="champ" value={role} onChange={(e) => setRole(e.target.value as "RH" | "DG" | "ADMIN")}>
          <option value="RH">RH</option>
          <option value="DG">DG</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        <div className="sm:col-span-4">
          {creer.isError && <p className="mb-2 text-sm text-red-600">{messageErreur(creer.error)}</p>}
          <button className="rounded bg-[#004B9C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Créer le compte
          </button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : (
        <table className="w-full rounded-lg border bg-white text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2">Nom</th><th className="px-4 py-2">Identifiant</th><th className="px-4 py-2">Rôle</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="px-4 py-2">{u.nom}</td>
                <td className="px-4 py-2">{u.identifiant}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">{u.actif ? "Actif" : "Désactivé"}</td>
                <td className="px-4 py-2">
                  {u.actif && (
                    <button onClick={() => desactiver.mutate(u.id)} className="text-sm text-red-600 hover:underline">
                      Désactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
