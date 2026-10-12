// Données de test partagées (ce dossier n'est pas inclus dans l'application construite).
import type { Catalog } from "../src/suggest";
import type { ApiLeg, TopMatch, TopMatchesResponse } from "../src/types";

// Liste telle que la renvoie GET /api/teams (extrait).
const league = (key: string, nom: string) => ({ key, nom, pays: "X", charge: true });
export const CATALOG = {
  complet: true,
  championnats: [league("PL", "Premier League"), league("FL1", "Ligue 1"), league("PD", "Liga"), league("SA", "Serie A"), league("BL1", "Bundesliga")],
  equipes: [
    { nom: "Arsenal", championnat: "PL", noms: ["Arsenal FC", "The Gunners"] },
    { nom: "Manchester City", championnat: "PL", noms: ["Man City", "Manchester City FC", "Citizens"] },
    { nom: "Manchester United", championnat: "PL", noms: ["Man United", "Man Utd", "Red Devils"] },
    { nom: "Tottenham Hotspur", championnat: "PL", noms: ["Spurs", "Tottenham"] },
    { nom: "Paris SG", championnat: "FL1", noms: ["PSG", "Paris Saint-Germain", "Paris Saint Germain"] },
    { nom: "Paris FC", championnat: "FL1", noms: [] },
    { nom: "Marseille", championnat: "FL1", noms: ["Olympique de Marseille", "OM"] },
    { nom: "Barcelona", championnat: "PD", noms: ["FC Barcelona", "Barça", "Barca"] },
    { nom: "Atlético Madrid", championnat: "PD", noms: ["Atletico Madrid", "Atleti"] },
    { nom: "Real Madrid", championnat: "PD", noms: ["Real Madrid CF"] },
    { nom: "Real Sociedad", championnat: "PD", noms: [] },
    { nom: "Real Betis", championnat: "PD", noms: [] },
    { nom: "Inter Milan", championnat: "SA", noms: ["Inter", "FC Internazionale Milano", "Internazionale"] },
    { nom: "AC Milan", championnat: "SA", noms: ["Milan"] },
    { nom: "Bayern Munich", championnat: "BL1", noms: ["FC Bayern München", "Bayern", "FC Bayern"] },
    { nom: "Borussia Dortmund", championnat: "BL1", noms: ["BVB", "Dortmund"] },
  ],
} satisfies Catalog;

export const inFuture = (hours: number): string => new Date(Date.now() + hours * 3600000).toISOString();

export const topEntry = (i: number, over: Partial<TopMatch> = {}): TopMatch => ({
  id: 100 + i,
  homeTeam: ["Arsenal", "Real Madrid", "Inter"][i],
  awayTeam: ["Chelsea", "Getafe", "Torino"][i],
  competition: ["Premier League", "Primera División", "Serie A"][i],
  date: inFuture(10 + i),
  meilleurPari: ["Plus de 1.5 buts", "Victoire ou nul domicile", "Plus de 0.5 buts"][i],
  probabilite: [78.4, 76.1, 83.9][i],
  coteEstimee: [1.28, 1.31, 1.19][i],
  niveauConfiance: ["eleve", "moyen", "eleve"][i],
  justification: `Justification du match ${i}`,
  vigilance: i === 0 ? "Rotation possible" : "",
  statsHome: { forme: "VVNVV" },
  statsAway: { forme: "DNDDV" },
  homeAway1: null,
  homeAway2: null,
  h2h: null,
  ia: { statut: "ok" },
  ...over,
});

export const topPayload = (over: Partial<TopMatchesResponse> = {}): TopMatchesResponse => ({
  fenetreHeures: 72,
  objectifCote: 2.5,
  avertissement: "Cotes estimées (1 ÷ probabilité), sans marge de bookmaker : les cotes réelles proposées par un opérateur seront plus basses.",
  complet: true,
  donnees: { championnatsPrets: ["PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "BSA"] },
  topMatches: [topEntry(0), topEntry(1), topEntry(2)],
  coteTotale: "2.66",
  probabiliteCombinee: 37.6,
  objectifCoteAtteint: true,
  ia: { statut: "ok", modele: "claude-sonnet-5-5" },
  ...over,
});

export const okLeg = (over: ApiLeg = {}): ApiLeg => ({
  etat: "ok",
  equipe1: "Arsenal",
  equipe2: "Chelsea",
  typePari: "Plus de 1.5 buts",
  probabilite: 62.3,
  coteEstimee: 1.61,
  niveauConfiance: "moyen",
  justification: "Le modèle attend 1,8 but pour Arsenal.",
  vigilance: "",
  ia: { statut: "ok", modele: "claude-sonnet-5-5" },
  ...over,
});

// Analyse en deux temps : réponse du modèle seul, puis réponse relue par l'IA.
export const quick = (over: ApiLeg = {}): ApiLeg =>
  okLeg({ probabilite: 60, ajustementIA: 0, justification: "Texte du modèle.", ia: { statut: "non_demandee" }, ...over });
export const reviewed = (over: ApiLeg = {}): ApiLeg =>
  okLeg({ probabilite: 62.5, ajustementIA: 2.5, justification: "Texte relu par l'IA.", ia: { statut: "ok", modele: "claude-sonnet-5-5" }, ...over });

export const parisLeg = (over: ApiLeg = {}): ApiLeg =>
  okLeg({ equipe1: "Paris SG", equipe2: "Marseille", competition: "Ligue 1", date: "2026-10-18T19:45:00.000Z", ...over });
