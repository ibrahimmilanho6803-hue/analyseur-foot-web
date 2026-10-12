// Formes des données échangées avec le serveur (analyseur-foot-backend) et gardées sur le téléphone.

export interface IaInfo {
  /** ok | indisponible | desactivee | non_demandee | non_applicable | partielle */
  statut?: string;
  modele?: string;
  code?: string;
  message?: string;
}

export interface SideRecord {
  won?: number;
  draw?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  avgGoalsFor?: number | string;
}

export interface HomeAway {
  home?: SideRecord;
  away?: SideRecord;
}

export interface HeadToHead {
  matches?: { homeTeam: string; awayTeam: string; score: string }[];
  bilan?: { homeWins?: number; draws?: number; awayWins?: number };
}

export interface Suggestions {
  equipe1?: string[];
  equipe2?: string[];
}

/** Une sélection analysée, telle que la renvoient POST /api/analyze (legs) et POST /api/auto-coupon (resultats). */
export interface ApiLeg {
  index?: number;
  /** ok | equipe_inconnue | ambigu | ligues_differentes | marche_inconnu | chargement | donnees_indisponibles | meme_equipe | erreur */
  etat?: string;
  probabilite?: number | null;
  typePari?: string;
  equipe1?: string;
  equipe2?: string;
  competition?: string;
  date?: string;
  justification?: string;
  vigilance?: string;
  niveauConfiance?: string;
  statsEquipe1?: unknown;
  statsEquipe2?: unknown;
  h2h?: HeadToHead | null;
  homeAway1?: HomeAway | null;
  homeAway2?: HomeAway | null;
  message?: string;
  suggestions?: Suggestions;
  ia?: IaInfo;
  [autre: string]: unknown;
}

export interface AnalyzeResponse {
  legs?: ApiLeg[];
}

export interface AutoCouponResponse {
  resultats?: ApiLeg[];
}

/** Un match du « Top Matchs » (GET /api/top-matches). */
export interface TopMatch {
  id?: number | string;
  homeTeam: string;
  awayTeam: string;
  competition?: string;
  date?: string;
  meilleurPari: string;
  probabilite: number;
  coteEstimee?: number;
  niveauConfiance?: string;
  justification?: string;
  vigilance?: string;
  statsHome?: unknown;
  statsAway?: unknown;
  homeAway1?: HomeAway | null;
  homeAway2?: HomeAway | null;
  h2h?: HeadToHead | null;
  ia?: IaInfo;
}

export interface TopMatchesResponse {
  topMatches?: TopMatch[];
  coteTotale?: string | number;
  probabiliteCombinee?: number;
  objectifCoteAtteint?: boolean;
  objectifCote?: number;
  avertissement?: string;
  avertissementDonnees?: string;
  message?: string;
  ia?: IaInfo;
  complet?: boolean;
  perime?: boolean;
  fenetreHeures?: number;
  donnees?: { championnatsPrets?: string[] };
}

/** Ce qui est gardé du dernier « Top Matchs » pour l'affichage. */
export interface TopMeta {
  coteTotale?: string | number;
  probabiliteCombinee?: number;
  objectifCoteAtteint?: boolean;
  objectifCote?: number;
  avertissement?: string;
  avertissementDonnees?: string;
  message?: string;
  ia?: IaInfo;
  complet?: boolean;
  perime?: boolean;
  fenetreHeures?: number;
  nbChampionnats: number | null;
}

/** Résultat de l'analyse d'une sélection. p vaut null quand le serveur n'a pas pu chiffrer : aucune probabilité n'est inventée. */
export interface Estimate {
  p: number | null;
  message?: string;
  equipe1?: string;
  equipe2?: string;
  competition?: string;
  date?: string;
  reason?: string;
  vigilance?: string;
  confidence?: string;
  statsEquipe1?: unknown;
  statsEquipe2?: unknown;
  h2h?: HeadToHead | null;
  homeAway1?: HomeAway | null;
  homeAway2?: HomeAway | null;
}

export type ProbSource = "analyse" | "historique" | "general";

export interface ProbEstimate {
  p: number;
  source: ProbSource;
  stats?: unknown;
  n?: number;
}

/** Une sélection du coupon en préparation. */
export interface Selection {
  id: string;
  equipe1: string;
  equipe2: string;
  typePari: string;
  matchDate: string;
}

/** Un match saisi dans l'onglet « Auto ». */
export interface MatchToGenerate {
  id: string;
  equipe1: string;
  equipe2: string;
  matchDate: string;
}

export type Statut = "en_attente" | "gagne" | "perdu";

/** Un pari enregistré dans l'historique du téléphone. */
export interface Pronostic {
  id: string;
  couponId: string;
  equipe1: string;
  equipe2: string;
  typePari: string;
  cote: number | null;
  matchDate: string;
  statut: Statut;
  date: string;
}

export interface GenReport {
  added: number;
  problems: string[];
}

export type TabKey = "top" | "build" | "gen" | "history";
