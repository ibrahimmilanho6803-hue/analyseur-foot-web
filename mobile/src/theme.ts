// Identité visuelle de l'application : vert « pelouse de nuit » et or. Mêmes valeurs que le site (variables au début de src/styles.css,
// à la racine du dépôt) : le test __tests__/coherenceSite.test.ts vérifie que les couleurs restent identiques.
export const T = {
  // Fonds, du plus profond au plus clair : page, cartes, zones en relief à l'intérieur d'une carte (champs, pastilles).
  bgDeep: "#07140E",
  surface: "#0E2217",
  raised: "#143021",
  // Filets.
  line: "#1E3C2B",
  lineStrong: "#2F5A43",
  // Textes : principal, secondaire, discret (ne jamais l'utiliser pour une information essentielle).
  chalk: "#EEF2EA",
  chalkDim: "#A4B8AA",
  faint: "#7C957F",
  // Accents : or (action principale), vert (gagné, fiable), rouge (perdu, risqué), bleu (information).
  gold: "#E3B23C",
  goldDeep: "#C99A25",
  goldInk: "#1B1503",
  win: "#3ECF8E",
  loss: "#F0705A",
  info: "#6DB7F2",
} as const;

// Une famille de police par graisse : sur Android, `fontWeight` ne choisit pas une graisse dans une police personnalisée.
// Les polices sont chargées au démarrage (App.tsx). Si le chargement échoue, le téléphone utilise sa police par défaut.
//   Oswald : titres et grands chiffres ; Inter : texte ; JetBrains Mono : petits chiffres alignés (cotes, pourcentages secondaires).
export const F = {
  title: "Oswald_700Bold",
  titleMedium: "Oswald_600SemiBold",
  mono: "JetBrainsMono_700Bold",
  monoMedium: "JetBrainsMono_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const;

// Espacements (grille de 4) et arrondis : toujours ces valeurs, pour que tous les écrans respirent de la même façon.
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const RD = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

// Couleur avec transparence (« #RRGGBBAA », pris en charge par React Native) : alpha de 0 à 1.
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex + v.toString(16).padStart(2, "0");
}

// Couleur d'une probabilité (en %) : vert quand elle est solide, or quand elle est moyenne, rouge quand le pari est risqué.
export function probTone(percent: number): string {
  return percent >= 70 ? T.win : percent >= 50 ? T.gold : T.loss;
}
