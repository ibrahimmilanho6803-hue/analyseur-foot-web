// Types de paris reconnus par le serveur (mêmes noms que l'API). L'équipe 1 reçoit (domicile), l'équipe 2 se déplace ; « victoire ou nul »
// est la double chance (1X, 2X). « Autre » sert seulement à l'historique. Les lignes entières (« plus de 2 buts ») sont remboursées quand le
// total tombe pile sur la ligne : le serveur en donne la probabilité à part (remboursement).
//
// Présentation du sélecteur : les paris proposés, regroupés par famille (la fenêtre de choix les déplie un groupe à la fois). « Autre » n'y figure pas :
// le serveur ne le reconnaît pas (il n'existe que pour l'historique).
export const BET_GROUPS = [
  {
    title: "Résultat du match",
    types: [
      "Victoire équipe 1",
      "Victoire équipe 2",
      "Match nul",
      "Victoire ou nul équipe 1",
      "Victoire ou nul équipe 2",
      "Victoire équipe 1 ou équipe 2",
    ],
  },
  {
    title: "Total de buts du match",
    types: [
      "Plus de 0.5 buts",
      "Plus de 1 but",
      "Plus de 1.5 buts",
      "Plus de 2 buts",
      "Plus de 2.5 buts",
      "Plus de 3 buts",
      "Plus de 3.5 buts",
      "Moins de 0.5 buts",
      "Moins de 1 but",
      "Moins de 1.5 buts",
      "Moins de 2 buts",
      "Moins de 2.5 buts",
      "Moins de 3 buts",
      "Moins de 3.5 buts",
    ],
  },
  {
    title: "Les deux équipes marquent",
    types: [
      "Les deux équipes marquent",
      "Les deux équipes ne marquent pas",
    ],
  },
  {
    title: "Buts de l'équipe 1",
    types: [
      "Équipe 1 plus de 0.5 buts",
      "Équipe 1 plus de 1 but",
      "Équipe 1 plus de 1.5 buts",
      "Équipe 1 plus de 2 buts",
      "Équipe 1 plus de 2.5 buts",
      "Équipe 1 moins de 0.5 buts",
      "Équipe 1 moins de 1 but",
      "Équipe 1 moins de 1.5 buts",
      "Équipe 1 moins de 2 buts",
      "Équipe 1 moins de 2.5 buts",
    ],
  },
  {
    title: "Buts de l'équipe 2",
    types: [
      "Équipe 2 plus de 0.5 buts",
      "Équipe 2 plus de 1 but",
      "Équipe 2 plus de 1.5 buts",
      "Équipe 2 plus de 2 buts",
      "Équipe 2 plus de 2.5 buts",
      "Équipe 2 moins de 0.5 buts",
      "Équipe 2 moins de 1 but",
      "Équipe 2 moins de 1.5 buts",
      "Équipe 2 moins de 2 buts",
      "Équipe 2 moins de 2.5 buts",
    ],
  },
  {
    title: "Victoire équipe 1 et total de buts",
    types: [
      "Victoire équipe 1 et plus de 0.5 buts",
      "Victoire équipe 1 et plus de 1.5 buts",
      "Victoire équipe 1 et plus de 2.5 buts",
      "Victoire équipe 1 et plus de 3.5 buts",
      "Victoire équipe 1 et moins de 1.5 buts",
      "Victoire équipe 1 et moins de 2.5 buts",
      "Victoire équipe 1 et moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire ou nul équipe 1 et total de buts",
    types: [
      "Victoire ou nul équipe 1 et plus de 0.5 buts",
      "Victoire ou nul équipe 1 et plus de 1.5 buts",
      "Victoire ou nul équipe 1 et plus de 2.5 buts",
      "Victoire ou nul équipe 1 et plus de 3.5 buts",
      "Victoire ou nul équipe 1 et moins de 1.5 buts",
      "Victoire ou nul équipe 1 et moins de 2.5 buts",
      "Victoire ou nul équipe 1 et moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire équipe 2 et total de buts",
    types: [
      "Victoire équipe 2 et plus de 0.5 buts",
      "Victoire équipe 2 et plus de 1.5 buts",
      "Victoire équipe 2 et plus de 2.5 buts",
      "Victoire équipe 2 et plus de 3.5 buts",
      "Victoire équipe 2 et moins de 1.5 buts",
      "Victoire équipe 2 et moins de 2.5 buts",
      "Victoire équipe 2 et moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire ou nul équipe 2 et total de buts",
    types: [
      "Victoire ou nul équipe 2 et plus de 0.5 buts",
      "Victoire ou nul équipe 2 et plus de 1.5 buts",
      "Victoire ou nul équipe 2 et plus de 2.5 buts",
      "Victoire ou nul équipe 2 et plus de 3.5 buts",
      "Victoire ou nul équipe 2 et moins de 1.5 buts",
      "Victoire ou nul équipe 2 et moins de 2.5 buts",
      "Victoire ou nul équipe 2 et moins de 3.5 buts",
    ],
  },
  {
    title: "Au moins une équipe marque",
    types: [
      "Au moins une équipe marque plus de 0.5 buts",
      "Au moins une équipe marque plus de 1.5 buts",
      "Au moins une équipe marque plus de 2.5 buts",
      "Au moins une équipe marque plus de 3.5 buts",
    ],
  },
  {
    title: "Victoire équipe 1 et buts de l'équipe 1",
    types: [
      "Victoire équipe 1 et total équipe 1 plus de 0.5 buts",
      "Victoire équipe 1 et total équipe 1 plus de 1.5 buts",
      "Victoire équipe 1 et total équipe 1 plus de 2.5 buts",
      "Victoire équipe 1 et total équipe 1 plus de 3.5 buts",
      "Victoire équipe 1 et total équipe 1 moins de 1.5 buts",
      "Victoire équipe 1 et total équipe 1 moins de 2.5 buts",
      "Victoire équipe 1 et total équipe 1 moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire ou nul équipe 1 et buts de l'équipe 1",
    types: [
      "Victoire ou nul équipe 1 et total équipe 1 plus de 0.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 plus de 1.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 plus de 2.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 plus de 3.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 moins de 1.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 moins de 2.5 buts",
      "Victoire ou nul équipe 1 et total équipe 1 moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire équipe 2 et buts de l'équipe 2",
    types: [
      "Victoire équipe 2 et total équipe 2 plus de 0.5 buts",
      "Victoire équipe 2 et total équipe 2 plus de 1.5 buts",
      "Victoire équipe 2 et total équipe 2 plus de 2.5 buts",
      "Victoire équipe 2 et total équipe 2 plus de 3.5 buts",
      "Victoire équipe 2 et total équipe 2 moins de 1.5 buts",
      "Victoire équipe 2 et total équipe 2 moins de 2.5 buts",
      "Victoire équipe 2 et total équipe 2 moins de 3.5 buts",
    ],
  },
  {
    title: "Victoire ou nul équipe 2 et buts de l'équipe 2",
    types: [
      "Victoire ou nul équipe 2 et total équipe 2 plus de 0.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 plus de 1.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 plus de 2.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 plus de 3.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 moins de 1.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 moins de 2.5 buts",
      "Victoire ou nul équipe 2 et total équipe 2 moins de 3.5 buts",
    ],
  },
  {
    title: "Score",
    types: [
      "Score exact",
    ],
  },
];

export const TYPES_PARI = [...BET_GROUPS.flatMap((group) => group.types), "Autre"];

// Probabilités moyennes d'un match de championnat : utilisées seulement tant qu'aucune analyse n'a été faite. Pour une ligne entière, c'est la
// probabilité de gagner quand le pari n'est pas remboursé (comme celle du serveur).
export const BASELINE_RATES = {
  "Victoire équipe 1": 0.44, "Victoire équipe 2": 0.28, "Match nul": 0.28, "Victoire ou nul équipe 1": 0.72, "Victoire ou nul équipe 2": 0.56,
  "Victoire équipe 1 ou équipe 2": 0.72, "Plus de 0.5 buts": 0.92, "Plus de 1 but": 0.9, "Plus de 1.5 buts": 0.75, "Plus de 2 buts": 0.67,
  "Plus de 2.5 buts": 0.49, "Plus de 3 buts": 0.35, "Plus de 3.5 buts": 0.27, "Moins de 0.5 buts": 0.08, "Moins de 1 but": 0.1,
  "Moins de 1.5 buts": 0.25, "Moins de 2 buts": 0.33, "Moins de 2.5 buts": 0.51, "Moins de 3 buts": 0.65, "Moins de 3.5 buts": 0.73,
  "Les deux équipes marquent": 0.54, "Les deux équipes ne marquent pas": 0.46, "Équipe 1 plus de 0.5 buts": 0.78, "Équipe 1 plus de 1 but": 0.66,
  "Équipe 1 plus de 1.5 buts": 0.44, "Équipe 1 plus de 2 buts": 0.26, "Équipe 1 plus de 2.5 buts": 0.19, "Équipe 1 moins de 0.5 buts": 0.22,
  "Équipe 1 moins de 1 but": 0.34, "Équipe 1 moins de 1.5 buts": 0.56, "Équipe 1 moins de 2 buts": 0.74, "Équipe 1 moins de 2.5 buts": 0.81,
  "Équipe 2 plus de 0.5 buts": 0.68, "Équipe 2 plus de 1 but": 0.5, "Équipe 2 plus de 1.5 buts": 0.32, "Équipe 2 plus de 2 buts": 0.14,
  "Équipe 2 plus de 2.5 buts": 0.11, "Équipe 2 moins de 0.5 buts": 0.32, "Équipe 2 moins de 1 but": 0.5, "Équipe 2 moins de 1.5 buts": 0.68,
  "Équipe 2 moins de 2 buts": 0.86, "Équipe 2 moins de 2.5 buts": 0.89, "Victoire équipe 1 et plus de 0.5 buts": 0.44,
  "Victoire équipe 1 et plus de 1.5 buts": 0.35, "Victoire équipe 1 et plus de 2.5 buts": 0.27, "Victoire équipe 1 et plus de 3.5 buts": 0.14,
  "Victoire équipe 1 et moins de 1.5 buts": 0.1, "Victoire équipe 1 et moins de 2.5 buts": 0.18, "Victoire équipe 1 et moins de 3.5 buts": 0.31,
  "Victoire ou nul équipe 1 et plus de 0.5 buts": 0.64, "Victoire ou nul équipe 1 et plus de 1.5 buts": 0.54,
  "Victoire ou nul équipe 1 et plus de 2.5 buts": 0.33, "Victoire ou nul équipe 1 et plus de 3.5 buts": 0.2,
  "Victoire ou nul équipe 1 et moins de 1.5 buts": 0.18, "Victoire ou nul équipe 1 et moins de 2.5 buts": 0.39,
  "Victoire ou nul équipe 1 et moins de 3.5 buts": 0.52, "Victoire équipe 2 et plus de 0.5 buts": 0.28, "Victoire équipe 2 et plus de 1.5 buts": 0.21,
  "Victoire équipe 2 et plus de 2.5 buts": 0.16, "Victoire équipe 2 et plus de 3.5 buts": 0.07, "Victoire équipe 2 et moins de 1.5 buts": 0.07,
  "Victoire équipe 2 et moins de 2.5 buts": 0.12, "Victoire équipe 2 et moins de 3.5 buts": 0.21,
  "Victoire ou nul équipe 2 et plus de 0.5 buts": 0.48, "Victoire ou nul équipe 2 et plus de 1.5 buts": 0.41,
  "Victoire ou nul équipe 2 et plus de 2.5 buts": 0.23, "Victoire ou nul équipe 2 et plus de 3.5 buts": 0.14,
  "Victoire ou nul équipe 2 et moins de 1.5 buts": 0.15, "Victoire ou nul équipe 2 et moins de 2.5 buts": 0.33,
  "Victoire ou nul équipe 2 et moins de 3.5 buts": 0.42, "Au moins une équipe marque plus de 0.5 buts": 0.92,
  "Au moins une équipe marque plus de 1.5 buts": 0.62, "Au moins une équipe marque plus de 2.5 buts": 0.28,
  "Au moins une équipe marque plus de 3.5 buts": 0.09, "Victoire équipe 1 et total équipe 1 plus de 0.5 buts": 0.44,
  "Victoire équipe 1 et total équipe 1 plus de 1.5 buts": 0.35, "Victoire équipe 1 et total équipe 1 plus de 2.5 buts": 0.18,
  "Victoire équipe 1 et total équipe 1 plus de 3.5 buts": 0.06, "Victoire équipe 1 et total équipe 1 moins de 1.5 buts": 0.1,
  "Victoire équipe 1 et total équipe 1 moins de 2.5 buts": 0.27, "Victoire équipe 1 et total équipe 1 moins de 3.5 buts": 0.38,
  "Victoire ou nul équipe 1 et total équipe 1 plus de 0.5 buts": 0.64, "Victoire ou nul équipe 1 et total équipe 1 plus de 1.5 buts": 0.41,
  "Victoire ou nul équipe 1 et total équipe 1 plus de 2.5 buts": 0.19, "Victoire ou nul équipe 1 et total équipe 1 plus de 3.5 buts": 0.07,
  "Victoire ou nul équipe 1 et total équipe 1 moins de 1.5 buts": 0.31, "Victoire ou nul équipe 1 et total équipe 1 moins de 2.5 buts": 0.53,
  "Victoire ou nul équipe 1 et total équipe 1 moins de 3.5 buts": 0.65, "Victoire équipe 2 et total équipe 2 plus de 0.5 buts": 0.28,
  "Victoire équipe 2 et total équipe 2 plus de 1.5 buts": 0.21, "Victoire équipe 2 et total équipe 2 plus de 2.5 buts": 0.09,
  "Victoire équipe 2 et total équipe 2 plus de 3.5 buts": 0.03, "Victoire équipe 2 et total équipe 2 moins de 1.5 buts": 0.07,
  "Victoire équipe 2 et total équipe 2 moins de 2.5 buts": 0.19, "Victoire équipe 2 et total équipe 2 moins de 3.5 buts": 0.25,
  "Victoire ou nul équipe 2 et total équipe 2 plus de 0.5 buts": 0.48, "Victoire ou nul équipe 2 et total équipe 2 plus de 1.5 buts": 0.27,
  "Victoire ou nul équipe 2 et total équipe 2 plus de 2.5 buts": 0.1, "Victoire ou nul équipe 2 et total équipe 2 plus de 3.5 buts": 0.03,
  "Victoire ou nul équipe 2 et total équipe 2 moins de 1.5 buts": 0.28, "Victoire ou nul équipe 2 et total équipe 2 moins de 2.5 buts": 0.45,
  "Victoire ou nul équipe 2 et total équipe 2 moins de 3.5 buts": 0.53, "Score exact": 0.1, "Autre": 0.4,
};

// Paris à ligne entière : remboursés (mise rendue) quand le résultat tombe pile sur la ligne. Même texte que le serveur (« remboursement.quand »).
export const REFUND_WHEN = {
  "Plus de 1 but": "le match se termine avec exactement 1 but au total",
  "Moins de 1 but": "le match se termine avec exactement 1 but au total",
  "Plus de 2 buts": "le match se termine avec exactement 2 buts au total",
  "Moins de 2 buts": "le match se termine avec exactement 2 buts au total",
  "Plus de 3 buts": "le match se termine avec exactement 3 buts au total",
  "Moins de 3 buts": "le match se termine avec exactement 3 buts au total",
  "Équipe 1 plus de 1 but": "l'équipe 1 marque exactement 1 but",
  "Équipe 1 moins de 1 but": "l'équipe 1 marque exactement 1 but",
  "Équipe 1 plus de 2 buts": "l'équipe 1 marque exactement 2 buts",
  "Équipe 1 moins de 2 buts": "l'équipe 1 marque exactement 2 buts",
  "Équipe 2 plus de 1 but": "l'équipe 2 marque exactement 1 but",
  "Équipe 2 moins de 1 but": "l'équipe 2 marque exactement 1 but",
  "Équipe 2 plus de 2 buts": "l'équipe 2 marque exactement 2 buts",
  "Équipe 2 moins de 2 buts": "l'équipe 2 marque exactement 2 buts",
};

// Noms d'anciennes versions (« Victoire domicile », « Equipe extérieur 1.5 buts plus »…) : l'historique déjà enregistré sur l'appareil
// continue de compter, sous le nom actuel du même pari.
export const LEGACY_LABELS = {
  "Victoire domicile": "Victoire équipe 1", "Victoire extérieur": "Victoire équipe 2", "Victoire exterieur": "Victoire équipe 2",
  "Victoire ou nul domicile": "Victoire ou nul équipe 1", "Victoire ou nul extérieur": "Victoire ou nul équipe 2",
  "Victoire domicile ou extérieur": "Victoire équipe 1 ou équipe 2", "Total buts 1.5 plus": "Plus de 1.5 buts",
  "Equipe domicile 0.5 buts plus": "Équipe 1 plus de 0.5 buts", "Equipe extérieur 0.5 buts plus": "Équipe 2 plus de 0.5 buts",
  "Victoire/nul domicile + 0.5 buts plus": "Victoire ou nul équipe 1 et plus de 0.5 buts",
  "Victoire/nul extérieur + 0.5 buts plus": "Victoire ou nul équipe 2 et plus de 0.5 buts",
  "Equipe domicile 1.5 buts plus": "Équipe 1 plus de 1.5 buts", "Equipe extérieur 1.5 buts plus": "Équipe 2 plus de 1.5 buts",
  "Victoire/nul domicile + 1.5 buts plus": "Victoire ou nul équipe 1 et plus de 1.5 buts",
  "Victoire/nul extérieur + 1.5 buts plus": "Victoire ou nul équipe 2 et plus de 1.5 buts",
  "Equipe domicile 2.5 buts plus": "Équipe 1 plus de 2.5 buts", "Equipe extérieur 2.5 buts plus": "Équipe 2 plus de 2.5 buts",
  "Victoire/nul domicile + 2.5 buts plus": "Victoire ou nul équipe 1 et plus de 2.5 buts",
  "Victoire/nul extérieur + 2.5 buts plus": "Victoire ou nul équipe 2 et plus de 2.5 buts",
  "Victoire domicile + 1.5 buts plus": "Victoire équipe 1 et plus de 1.5 buts",
  "Victoire extérieur + 1.5 buts plus": "Victoire équipe 2 et plus de 1.5 buts",
  "Victoire domicile + 2.5 buts plus": "Victoire équipe 1 et plus de 2.5 buts",
  "Victoire extérieur + 2.5 buts plus": "Victoire équipe 2 et plus de 2.5 buts",
};
export const canonicalLabel = (label) => LEGACY_LABELS[label] || label;
