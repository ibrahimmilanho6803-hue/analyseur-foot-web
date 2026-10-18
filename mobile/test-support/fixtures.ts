// Données de test partagées (ce dossier n'est pas inclus dans l'application construite).
import type { Catalog } from "../src/suggest";
import type { ApiLeg, CrossLeague, TopMatch, TopMatchesResponse } from "../src/types";

// Liste telle que la renvoie GET /api/teams (extrait).
const league = (key: string, nom: string) => ({ key, nom, pays: "X", charge: true });
export const CATALOG = {
  complet: true,
  championnats: [
    league("PL", "Premier League"),
    league("FL1", "Ligue 1"),
    league("PD", "Liga"),
    league("SA", "Serie A"),
    league("BL1", "Bundesliga"),
    league("PPL", "Liga Portugal"),
    league("EUR", "Autres clubs européens"), // clubs connus seulement par les coupes d'Europe
  ],
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
    { nom: "Benfica", championnat: "PPL", noms: ["SL Benfica"] },
    { nom: "Dinamo Zagreb", championnat: "EUR", noms: ["GNK Dinamo Zagreb"] },
  ],
} satisfies Catalog;

export const inFuture = (hours: number): string => new Date(Date.now() + hours * 3600000).toISOString();

// Quatre matchs, comme le « Top Matchs » du serveur : des paris autour de 67 % de chances, pour une cote totale d'environ 5.
export const topEntry = (i: number, over: Partial<TopMatch> = {}): TopMatch => ({
  id: 100 + i,
  homeTeam: ["Arsenal", "Real Madrid", "Inter", "Napoli"][i],
  awayTeam: ["Chelsea", "Getafe", "Torino", "Genoa"][i],
  competition: ["Premier League", "Primera División", "Serie A", "Serie A"][i],
  date: inFuture(10 + i),
  meilleurPari: ["Plus de 1.5 buts", "Victoire ou nul équipe 1", "Équipe 1 plus de 1.5 buts", "Moins de 3.5 buts"][i],
  probabilite: [67.4, 66.6, 66.8, 66.5][i],
  coteEstimee: [1.48, 1.5, 1.5, 1.5][i],
  niveauConfiance: ["eleve", "moyen", "eleve", "moyen"][i],
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
  avertissement: "Cotes estimées (1 ÷ probabilité), sans marge de bookmaker : les cotes réelles proposées par un opérateur seront plus basses.",
  complet: true,
  donnees: { championnatsPrets: ["PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "BSA"] },
  topMatches: [topEntry(0), topEntry(1), topEntry(2), topEntry(3)],
  coteTotale: "5.01",
  probabiliteCombinee: 19.9,
  objectifCote: 5,
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

// Comparaison renvoyée par le serveur quand les deux clubs ne jouent pas dans le même championnat (Ligue des champions…).
export const CROSS_MESSAGE =
  "Ces deux clubs ne jouent pas dans le même championnat : leur niveau relatif est estimé grâce aux matchs de coupes d'Europe. Estimation moins précise qu'entre deux clubs d'un même championnat.";
export const CROSS_WEAK_MESSAGE =
  "L'un de ces clubs ne joue dans aucun championnat suivi par l'application : son niveau n'est estimé que d'après ses matchs de coupes d'Europe. Estimation peu précise.";
export const cross = (over: CrossLeague = {}): CrossLeague => ({
  championnat1: "Premier League",
  championnat2: "Liga",
  niveauDesChampionnatsMesure: true,
  message: CROSS_MESSAGE,
  ...over,
});
/** Une analyse de Ligue des champions : Arsenal (Premier League) reçoit le Real Madrid (Liga). */
export const cupLeg = (over: ApiLeg = {}): ApiLeg =>
  okLeg({ equipe1: "Arsenal", equipe2: "Real Madrid", competition: "UEFA Champions League", date: "2026-10-21T19:00:00.000Z", comparaisonEntreChampionnats: cross(), ...over });
