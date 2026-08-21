const FORMAT_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

// Codes Unicode des espaces non gérées par l'encodage WinAnsi des polices standard de pdfkit
// (Helvetica) : espace insécable (160), espace fine insécable (8239), espace fine (8201).
// Intl.NumberFormat("fr-FR") les utilise comme séparateur de milliers ; non substituées, elles
// s'affichent comme un caractère erroné dans un PDF généré par pdfkit ("23/000" au lieu de "23 000").
const CODES_ESPACES_NON_STANDARD = [160, 8239, 8201];
const ESPACES_NON_STANDARD = new RegExp(
  "[" + CODES_ESPACES_NON_STANDARD.map((c) => String.fromCharCode(c)).join("") + "]",
  "g"
);

export function formatMontantPdf(valeur: number): string {
  return FORMAT_FR.format(valeur).replace(ESPACES_NON_STANDARD, " ");
}
