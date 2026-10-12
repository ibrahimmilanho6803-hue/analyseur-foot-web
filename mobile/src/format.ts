import { canon } from "./suggest";

export const MAX_LEGS_PER_CALL = 12; // limite du serveur pour une requête

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Dates en français, écrites ici plutôt que par le téléphone : même affichage sur tous les appareils.
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const deux = (n: number) => String(n).padStart(2, "0");

/** « sam. 18 oct., 21:45 » (heure du téléphone). Vide si la date est absente ou invalide. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}, ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/** « 18/10/2026 » (jour du téléphone). Vide si la date est absente ou invalide. */
export function formatDay(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Clé d'un nom d'équipe (sans accents ni majuscules) : sert à repérer deux paris sur le même match.
export const normName = (s: unknown): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Avec une analyse, ce sont les noms reconnus par le serveur qui comptent : « PSG – OM » et « Paris SG – Marseille » sont le même match.
export const matchKey = (sel: { equipe1: string; equipe2: string }, est?: { equipe1?: string; equipe2?: string } | null): string =>
  normName((est && est.equipe1) || sel.equipe1) + "|" + normName((est && est.equipe2) || sel.equipe2);

// Le nom reconnu mérite d'être signalé quand il ne ressemble pas à la saisie (« PSG » → « Paris SG »), pas pour « Arsenal » → « Arsenal FC ».
export function nameDiffers(typed: string, recognized: string): boolean {
  const a = canon(typed);
  const b = canon(recognized);
  return Boolean(a && b) && a !== b && !a.includes(b) && !b.includes(a);
}

const CONFIDENCE_LABEL: Record<string, string> = { faible: "faible", moyen: "moyenne", eleve: "élevée" };
export const confidenceLabel = (c?: string | null): string => (c && CONFIDENCE_LABEL[c]) || c || "—";
