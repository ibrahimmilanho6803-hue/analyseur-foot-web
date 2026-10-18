// Recherche dans les types de paris de la fenêtre de choix (les données sont dans betTypes.js).
import { BET_GROUPS, canonicalLabel } from "./betTypes";
import { canon } from "./suggest";

/** Le groupe de la fenêtre qui contient ce pari (son titre), ou null. */
export const groupOf = (type) => {
  const group = BET_GROUPS.find((g) => g.types.includes(canonicalLabel(type)));
  return group ? group.title : null;
};

// Mots d'un texte, sans accents ni majuscules ; « 2.5 » et « 2,5 » restent un seul mot (« 2d5 »), distinct de « 2 » et de « 5 ».
const words = (text) => canon(String(text).replace(/(\d)[.,](\d)/g, "$1d$2")).split(" ").filter(Boolean);
const isNumber = (word) => /^\d+(d\d+)?$/.test(word);

/**
 * Chaque mot saisi doit se retrouver dans le nom du pari. Un nombre se compare en entier (« 2 » est l'équipe 2 ou la ligne de 2 buts,
 * pas « 2.5 ») ; un mot se cherche n'importe où dans le nom, au singulier comme au pluriel. Une saisie vide garde tout.
 */
export function matchesBet(label, query) {
  const wanted = words(query);
  if (wanted.length === 0) return true;
  const tokens = words(label);
  const text = tokens.join(" ");
  return wanted.every((w) => (isNumber(w) ? tokens.includes(w) : text.includes(w.length >= 4 && w.endsWith("s") ? w.slice(0, -1) : w)));
}

/** Les groupes de la fenêtre réduits aux paris qui correspondent à la recherche (les groupes vides disparaissent). */
export function searchGroups(query) {
  return BET_GROUPS.map((g) => ({ title: g.title, types: g.types.filter((t) => matchesBet(t, query)) })).filter((g) => g.types.length > 0);
}
