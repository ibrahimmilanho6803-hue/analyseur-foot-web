// Types de paris reconnus par le serveur (mêmes libellés que l'API). « Autre » sert seulement à l'historique.
export const TYPES_PARI = [
  "Victoire domicile",
  "Victoire extérieur",
  "Match nul",
  "Victoire ou nul domicile",
  "Victoire ou nul extérieur",
  "Victoire domicile ou extérieur",
  "Plus de 0.5 buts",
  "Moins de 0.5 buts",
  "Plus de 1.5 buts",
  "Moins de 1.5 buts",
  "Plus de 2.5 buts",
  "Moins de 2.5 buts",
  "Plus de 3.5 buts",
  "Moins de 3.5 buts",
  "Les deux équipes marquent",
  "Les deux équipes ne marquent pas",
  "Equipe domicile 0.5 buts plus",
  "Equipe extérieur 0.5 buts plus",
  "Equipe domicile 1.5 buts plus",
  "Equipe extérieur 1.5 buts plus",
  "Equipe domicile 2.5 buts plus",
  "Equipe extérieur 2.5 buts plus",
  "Victoire/nul domicile + 0.5 buts plus",
  "Victoire/nul extérieur + 0.5 buts plus",
  "Victoire/nul domicile + 1.5 buts plus",
  "Victoire/nul extérieur + 1.5 buts plus",
  "Victoire/nul domicile + 2.5 buts plus",
  "Victoire/nul extérieur + 2.5 buts plus",
  "Victoire domicile + 1.5 buts plus",
  "Victoire extérieur + 1.5 buts plus",
  "Victoire domicile + 2.5 buts plus",
  "Victoire extérieur + 2.5 buts plus",
  "Score exact",
  "Autre",
];

// Présentation du sélecteur : les paris proposés, regroupés par famille. « Autre » n'y figure pas : le serveur ne le
// reconnaît pas (il n'existe que pour l'historique).
export const BET_GROUPS: { title: string; types: string[] }[] = [
  {
    title: "Résultat du match",
    types: ["Victoire domicile", "Victoire extérieur", "Match nul", "Victoire ou nul domicile", "Victoire ou nul extérieur", "Victoire domicile ou extérieur"],
  },
  {
    title: "Total de buts du match",
    types: ["Plus de 0.5 buts", "Moins de 0.5 buts", "Plus de 1.5 buts", "Moins de 1.5 buts", "Plus de 2.5 buts", "Moins de 2.5 buts", "Plus de 3.5 buts", "Moins de 3.5 buts"],
  },
  { title: "Les deux équipes marquent", types: ["Les deux équipes marquent", "Les deux équipes ne marquent pas"] },
  {
    title: "Buts d'une équipe",
    types: [
      "Equipe domicile 0.5 buts plus",
      "Equipe extérieur 0.5 buts plus",
      "Equipe domicile 1.5 buts plus",
      "Equipe extérieur 1.5 buts plus",
      "Equipe domicile 2.5 buts plus",
      "Equipe extérieur 2.5 buts plus",
    ],
  },
  {
    title: "Résultat et buts",
    types: [
      "Victoire/nul domicile + 0.5 buts plus",
      "Victoire/nul extérieur + 0.5 buts plus",
      "Victoire/nul domicile + 1.5 buts plus",
      "Victoire/nul extérieur + 1.5 buts plus",
      "Victoire/nul domicile + 2.5 buts plus",
      "Victoire/nul extérieur + 2.5 buts plus",
      "Victoire domicile + 1.5 buts plus",
      "Victoire extérieur + 1.5 buts plus",
      "Victoire domicile + 2.5 buts plus",
      "Victoire extérieur + 2.5 buts plus",
    ],
  },
  { title: "Score", types: ["Score exact"] },
];

// Probabilités moyennes d'un match de championnat : utilisées seulement tant qu'aucune analyse n'a été faite.
export const BASELINE_RATES: Record<string, number> = {
  "Victoire domicile": 0.44, "Victoire extérieur": 0.28, "Match nul": 0.28,
  "Victoire ou nul domicile": 0.72, "Victoire ou nul extérieur": 0.56, "Victoire domicile ou extérieur": 0.72,
  "Plus de 0.5 buts": 0.92, "Moins de 0.5 buts": 0.08, "Plus de 1.5 buts": 0.75,
  "Moins de 1.5 buts": 0.25, "Plus de 2.5 buts": 0.49, "Moins de 2.5 buts": 0.51,
  "Plus de 3.5 buts": 0.27, "Moins de 3.5 buts": 0.73, "Les deux équipes marquent": 0.54,
  "Les deux équipes ne marquent pas": 0.46, "Equipe domicile 0.5 buts plus": 0.78, "Equipe extérieur 0.5 buts plus": 0.68,
  "Equipe domicile 1.5 buts plus": 0.44, "Equipe extérieur 1.5 buts plus": 0.32, "Equipe domicile 2.5 buts plus": 0.19,
  "Equipe extérieur 2.5 buts plus": 0.11, "Victoire/nul domicile + 0.5 buts plus": 0.64, "Victoire/nul extérieur + 0.5 buts plus": 0.48,
  "Victoire/nul domicile + 1.5 buts plus": 0.54, "Victoire/nul extérieur + 1.5 buts plus": 0.41, "Victoire/nul domicile + 2.5 buts plus": 0.33,
  "Victoire/nul extérieur + 2.5 buts plus": 0.23, "Victoire domicile + 1.5 buts plus": 0.35, "Victoire extérieur + 1.5 buts plus": 0.21,
  "Victoire domicile + 2.5 buts plus": 0.27, "Victoire extérieur + 2.5 buts plus": 0.16, "Score exact": 0.1,
  "Autre": 0.4,
};

// Libellés d'anciennes versions : l'historique déjà enregistré continue de compter.
const LEGACY_LABELS: Record<string, string> = { "Total buts 1.5 plus": "Plus de 1.5 buts", "Victoire exterieur": "Victoire extérieur" };
export const canonicalLabel = (label: string): string => LEGACY_LABELS[label] || label;
