// Lecture des réponses du serveur et estimation de la probabilité d'une sélection (même logique que l'application mobile).
import { BASELINE_RATES, canonicalLabel } from "./betTypes";

export const clampP = (p) => Math.min(0.99, Math.max(0.01, p));

// Comparaison entre championnats renvoyée par le serveur (clubs de championnats différents : Ligue des champions…) ; absente pour deux
// clubs du même championnat.
export function asCross(raw) {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : undefined;
}

// Remboursement annoncé par le serveur pour un pari à ligne entière (« Plus de 2 buts »…) ; absent (ou illisible) pour les autres paris.
export function asRefund(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { probabilite, quand } = raw;
  return typeof probabilite === "number" && Number.isFinite(probabilite) && typeof quand === "string" && quand.trim() ? { probabilite, quand: quand.trim() } : undefined;
}

// Phrase qui explique le remboursement d'un pari : « Remboursé si le match se termine avec exactement 2 buts au total (17.1 % de chances). »
// Sans probabilité (pari pas encore analysé), seule la règle est donnée.
export function refundNote(refund) {
  const chance = typeof refund.probabilite === "number" ? ` (${refund.probabilite} % de chances)` : "";
  return `Remboursé si ${refund.quand}${chance}.`;
}

// Avertissement à montrer à côté d'un pronostic entre clubs de championnats différents : le texte du serveur (il dit pourquoi
// l'estimation est moins précise), ou à défaut une phrase générale.
export function crossLeagueNote(cross) {
  if (!cross) return null;
  const message = typeof cross.message === "string" ? cross.message.trim() : "";
  return message || "Ces deux clubs ne jouent pas dans le même championnat : estimation moins précise qu'entre deux clubs d'un même championnat.";
}

// Mise en garde sous le total du coupon : count sélections opposent des clubs de championnats différents.
export function crossTotalNote(count) {
  return count > 1
    ? `${count} sélections opposent des clubs de championnats différents : leurs estimations sont moins précises, le pourcentage combiné aussi.`
    : "1 sélection oppose des clubs de championnats différents : son estimation est moins précise, le pourcentage combiné aussi.";
}

// Transforme la réponse du serveur pour une sélection. Sans analyse chiffrée, p vaut null : aucune probabilité n'est inventée.
export function toEstimate(r) {
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
      crossLeague: asCross(r.comparaisonEntreChampionnats),
      refund: asRefund(r.remboursement),
    };
  }
  const sug = r.suggestions ? [...(r.suggestions.equipe1 || []), ...(r.suggestions.equipe2 || [])].slice(0, 4) : [];
  return { p: null, message: (r.message || "Analyse impossible pour cette sélection.") + (sug.length ? ` Suggestions : ${sug.join(", ")}.` : "") };
}

function historicalRate(pronostics, typePari) {
  const items = pronostics.filter((p) => canonicalLabel(p.typePari) === typePari && p.statut !== "en_attente");
  if (items.length < 3) return null;
  return { rate: items.filter((p) => p.statut === "gagne").length / items.length, n: items.length };
}

// Une seule source par sélection : l'analyse du serveur si elle existe ; sinon l'historique personnel (lissé vers la
// moyenne, car trois paris gagnés ne prouvent rien) ; sinon la moyenne générale du type de pari.
export function estimateProb(pronostics, sel, aiEstimates) {
  const ai = aiEstimates[sel.id];
  if (ai && typeof ai.p === "number") return { p: ai.p, source: "analyse", stats: ai.statsEquipe1 || ai.statsEquipe2 };
  const type = canonicalLabel(sel.typePari);
  const base = BASELINE_RATES[type] ?? 0.4;
  const hist = historicalRate(pronostics, type);
  if (hist) return { p: (hist.rate * hist.n + base * 8) / (hist.n + 8), source: "historique", n: hist.n };
  return { p: base, source: "general" };
}

// Associe chaque sélection envoyée à la réponse du serveur (même ordre). iaDown : sélections que l'IA n'a pas pu relire.
export function estimatesForChunk(chunk, results) {
  const list = Array.isArray(results) ? results : [];
  const next = {};
  let iaDown = 0;
  chunk.forEach((sel, k) => {
    const r = list[k];
    next[sel.id] = toEstimate(r);
    if (r && r.etat === "ok" && r.ia && r.ia.statut === "indisponible") iaDown += 1;
  });
  return { next, iaDown };
}

// Une sélection attend la relecture de l'IA quand le serveur n'a répondu qu'avec le modèle statistique (demande avec ia: false).
export const awaitsReview = (r) => Boolean(r && r.etat === "ok" && r.ia && r.ia.statut === "non_demandee");

// Fusionne les estimations de la relecture dans celles déjà affichées, sans jamais remplacer une probabilité par un échec.
export function mergeEstimates(prev, next) {
  const out = { ...prev };
  for (const [id, est] of Object.entries(next)) {
    if (typeof est.p === "number" || !(prev[id] && typeof prev[id].p === "number")) out[id] = est;
  }
  return out;
}

// Estimation d'un match du « Top Matchs » (déjà analysé par le serveur).
export function fromTopMatch(m) {
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
    crossLeague: asCross(m.comparaisonEntreChampionnats),
    refund: asRefund(m.remboursement),
  };
}

const CONFIDENCE_LABEL = { faible: "faible", moyen: "moyenne", eleve: "élevée" };
export const confidenceLabel = (c) => CONFIDENCE_LABEL[c] || c || "—";

// Niveau de confiance en barres (0 à 3), pour la jauge.
export const confidenceLevel = (c) => (c === "eleve" ? 3 : c === "moyen" ? 2 : c === "faible" ? 1 : 0);
