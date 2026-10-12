// Lecture des réponses du serveur et estimation de la probabilité d'une sélection (même logique que le site).
import { BASELINE_RATES, canonicalLabel } from "./betTypes";
import type { ApiLeg, Estimate, ProbEstimate, Pronostic, Selection, TopMatch } from "./types";

export const clampP = (p: number): number => Math.min(0.99, Math.max(0.01, p));

// Transforme la réponse du serveur pour une sélection. Sans analyse chiffrée, p vaut null : aucune probabilité n'est inventée.
export function toEstimate(r: ApiLeg | null | undefined): Estimate {
  if (!r) return { p: null, message: "Pas de réponse du serveur pour cette sélection." };
  if (r.etat === "ok" && typeof r.probabilite === "number") {
    return {
      p: clampP(r.probabilite / 100),
      // Noms reconnus par le serveur (« PSG » → « Paris SG »), championnat et date du match si le serveur les connaît.
      equipe1: r.equipe1,
      equipe2: r.equipe2,
      competition: r.competition,
      date: r.date,
      reason: r.justification,
      vigilance: r.vigilance,
      confidence: r.niveauConfiance,
      statsEquipe1: r.statsEquipe1,
      statsEquipe2: r.statsEquipe2,
      h2h: r.h2h,
      homeAway1: r.homeAway1,
      homeAway2: r.homeAway2,
    };
  }
  const sug = r.suggestions ? [...(r.suggestions.equipe1 || []), ...(r.suggestions.equipe2 || [])].slice(0, 4) : [];
  return { p: null, message: (r.message || "Analyse impossible pour cette sélection.") + (sug.length ? ` Suggestions : ${sug.join(", ")}.` : "") };
}

function historicalRate(pronostics: Pick<Pronostic, "typePari" | "statut">[], typePari: string): { rate: number; n: number } | null {
  const items = pronostics.filter((p) => canonicalLabel(p.typePari) === typePari && p.statut !== "en_attente");
  if (items.length < 3) return null;
  return { rate: items.filter((p) => p.statut === "gagne").length / items.length, n: items.length };
}

// Une seule source par sélection : l'analyse du serveur si elle existe ; sinon l'historique personnel (lissé vers la
// moyenne, car trois paris gagnés ne prouvent rien) ; sinon la moyenne générale du type de pari.
export function estimateProb(
  pronostics: Pick<Pronostic, "typePari" | "statut">[],
  sel: Pick<Selection, "id" | "typePari">,
  aiEstimates: Record<string, Estimate>,
): ProbEstimate {
  const ai = aiEstimates[sel.id];
  if (ai && typeof ai.p === "number") return { p: ai.p, source: "analyse", stats: ai.statsEquipe1 || ai.statsEquipe2 };
  const base = BASELINE_RATES[sel.typePari] ?? 0.4;
  const hist = historicalRate(pronostics, sel.typePari);
  if (hist) return { p: (hist.rate * hist.n + base * 8) / (hist.n + 8), source: "historique", n: hist.n };
  return { p: base, source: "general" };
}

// Associe chaque sélection envoyée à la réponse du serveur (même ordre). iaDown : sélections que l'IA n'a pas pu relire.
export function estimatesForChunk(
  chunk: { id: string }[],
  results: ReadonlyArray<ApiLeg | null | undefined> | null | undefined,
): { next: Record<string, Estimate>; iaDown: number } {
  const list = Array.isArray(results) ? results : [];
  const next: Record<string, Estimate> = {};
  let iaDown = 0;
  chunk.forEach((sel, k) => {
    const r = list[k];
    next[sel.id] = toEstimate(r);
    if (r && r.etat === "ok" && r.ia && r.ia.statut === "indisponible") iaDown += 1;
  });
  return { next, iaDown };
}

// Une sélection attend la relecture de l'IA quand le serveur n'a répondu qu'avec le modèle statistique (demande avec ia: false).
export const awaitsReview = (r: ApiLeg | null | undefined): boolean => Boolean(r && r.etat === "ok" && r.ia && r.ia.statut === "non_demandee");

// Fusionne les estimations de la relecture dans celles déjà affichées, sans jamais remplacer une probabilité par un échec.
export function mergeEstimates(prev: Record<string, Estimate>, next: Record<string, Estimate>): Record<string, Estimate> {
  const out = { ...prev };
  for (const [id, est] of Object.entries(next)) {
    if (typeof est.p === "number" || !(prev[id] && typeof prev[id].p === "number")) out[id] = est;
  }
  return out;
}

// Estimation d'un match du « Top Matchs » (déjà analysé par le serveur).
export function fromTopMatch(m: TopMatch | null | undefined): Estimate {
  if (!m || typeof m.probabilite !== "number") return { p: null, message: "Probabilité indisponible pour ce match." };
  return {
    p: clampP(m.probabilite / 100),
    equipe1: m.homeTeam,
    equipe2: m.awayTeam,
    competition: m.competition,
    date: m.date,
    reason: m.justification,
    vigilance: m.vigilance,
    confidence: m.niveauConfiance,
    statsEquipe1: m.statsHome,
    statsEquipe2: m.statsAway,
    h2h: m.h2h,
    homeAway1: m.homeAway1,
    homeAway2: m.homeAway2,
  };
}
