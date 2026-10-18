// Petits utilitaires de date, d'identifiant et de noms de clubs.
import { canon } from "./suggest";

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }

// « ven. 16 oct., 02:34 »
export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// « 13/10/2026 »
export function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
}

// Clé d'un match (sans accents ni majuscules) : sert à repérer deux paris sur le même match.
export const normName = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Avec une analyse, ce sont les noms reconnus par le serveur qui comptent : « PSG – OM » et « Paris SG – Marseille » sont le même match.
export const matchKey = (sel, est) => normName((est && est.equipe1) || sel.equipe1) + "|" + normName((est && est.equipe2) || sel.equipe2);

// Le nom reconnu mérite d'être signalé quand il ne ressemble pas à la saisie (« PSG » → « Paris SG »), pas pour « Arsenal » → « Arsenal FC ».
export function nameDiffers(typed, recognized) {
  const a = canon(typed);
  const b = canon(recognized);
  return Boolean(a && b) && a !== b && !a.includes(b) && !b.includes(a);
}
