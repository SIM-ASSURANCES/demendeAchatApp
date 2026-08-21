import { api } from "./api";

// Ouvre un PDF authentifié (nécessitant l'en-tête Authorization) dans un nouvel onglet, via un
// blob local — un simple lien <a href> ne porterait pas le jeton d'accès.
//
// L'onglet est ouvert de façon synchrone, avant tout `await` : la plupart des navigateurs
// n'autorisent window.open() qu'à l'intérieur du geste utilisateur d'origine et bloquent tout
// appel différé après une opération asynchrone.
export async function ouvrirPdfAuthentifie(chemin: string) {
  const fenetre = window.open("", "_blank");
  try {
    const reponse = await api.get(chemin, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([reponse.data], { type: "application/pdf" }));
    if (fenetre) {
      fenetre.location.href = url;
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    fenetre?.close();
    throw err;
  }
}
