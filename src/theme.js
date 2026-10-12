// Couleurs et style de champ de saisie, partagés par l'écran principal et la saisie des clubs.
export const T = {
  bgDeep: "#0B1F16", surface: "#132A1F", line: "#1F3D2C",
  chalk: "#E9ECE3", chalkDim: "#8FA396", gold: "#D4A72C",
  win: "#4C9A6B", loss: "#C1503A",
};

export function inputStyle() {
  return { background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 6, padding: "10px", color: T.chalk, fontSize: 14, width: "100%" };
}
