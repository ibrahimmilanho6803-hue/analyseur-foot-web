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

/** Présent quand les deux clubs ne jouent pas dans le même championnat (Ligue des champions, par exemple) : l'estimation est moins précise. */
export interface CrossLeague {
  championnat1?: string;
  championnat2?: string;
  /** Vrai quand le niveau relatif des deux championnats est mesuré par assez de matchs de coupes d'Europe. */
  niveauDesChampionnatsMesure?: boolean;
  /** Explication rédigée par le serveur, à afficher telle quelle. */
  message?: string;
}

/** Pari à ligne entière (« plus de 2 buts ») : la mise est rendue quand le résultat tombe pile sur la ligne. `probabilite` est en %, `quand` le cas du remboursement. */
export interface Refund {
  probabilite: number;
  quand: string;
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
  comparaisonEntreChampionnats?: CrossLeague | null;
  /** Présent seulement pour un pari à ligne entière ; `probabilite` (du pari) est alors celle de gagner quand il n'est pas remboursé. */
  remboursement?: Refund | null;
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
  comparaisonEntreChampionnats?: CrossLeague | null;
  remboursement?: Refund | null;
}

export interface TopMatchesResponse {
  topMatches?: TopMatch[];
  coteTotale?: string | number;
  probabiliteCombinee?: number;
  avertissement?: string;
  avertissementDonnees?: string;
  message?: string;
  ia?: IaInfo;
  complet?: boolean;
  perime?: boolean;
  fenetreHeures?: number;
  donnees?: { championnatsPrets?: string[]; coupesPretes?: string[] };
}

/** Ce qui est gardé du dernier « Top Matchs » pour l'affichage. */
export interface TopMeta {
  coteTotale?: string | number;
  probabiliteCombinee?: number;
  avertissement?: string;
  avertissementDonnees?: string;
  message?: string;
  ia?: IaInfo;
  complet?: boolean;
  perime?: boolean;
  fenetreHeures?: number;
  nbChampionnats: number | null;
  /** Coupes d'Europe analysées en plus des championnats (0 ou absent avec un serveur qui n'en propose pas). */
  nbCoupes?: number;
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
  /** Renseigné quand les deux clubs viennent de championnats différents. */
  crossLeague?: CrossLeague;
  /** Renseigné pour un pari à ligne entière (remboursé quand le résultat tombe pile sur la ligne). */
  refund?: Refund;
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
