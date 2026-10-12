// Couleurs de l'application : les mêmes que le site (src/theme.js du site) pour une identité commune.
export const T = {
  bgDeep: "#0B1F16",
  surface: "#132A1F",
  line: "#1F3D2C",
  chalk: "#E9ECE3",
  chalkDim: "#8FA396",
  gold: "#D4A72C",
  win: "#4C9A6B",
  loss: "#C1503A",
} as const;

// Une famille de police par graisse : sur Android, `fontWeight` ne choisit pas une graisse dans une police personnalisée.
// Les polices sont chargées au démarrage (App.tsx). Si le chargement échoue, le téléphone utilise sa police par défaut.
export const F = {
  title: "Oswald_700Bold",
  titleMedium: "Oswald_600SemiBold",
  mono: "JetBrainsMono_700Bold",
  monoMedium: "JetBrainsMono_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const;

// Couleur avec transparence (« #RRGGBBAA », pris en charge par React Native) : alpha de 0 à 1.
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex + v.toString(16).padStart(2, "0");
}
