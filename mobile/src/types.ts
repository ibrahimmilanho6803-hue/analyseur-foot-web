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
  /** Cote équitable : (1 − remboursement) ÷ probabilité de gagner. */
  coteEstimee?: number;
  /** Pari à ligne entière (« plus de 2 buts ») : `probabilite` est celle de GAGNER ; ceci est la part des cas où la mise est remboursée (en %). */
  probabiliteRemboursement?: number | null;
  /** Règle de remboursement rédigée par le serveur, avec les noms des équipes. */
  regleRemboursement?: string;
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
  /** Pari à ligne entière : part des cas où la mise est remboursée (0 à 1). `p` reste la probabilité de gagner. */
  push?: number;
  /** Règle de remboursement rédigée par le serveur (avec les noms des équipes). */
  refundRule?: string;
}

export type ProbSource = "analyse" | "historique" | "general";

export interface ProbEstimate {
  /** Probabilité de gagner le pari. */
  p: number;
  source: ProbSource;
  stats?: unknown;
  n?: number;
  /** Pari à ligne entière : probabilité du remboursement de la mise (0 pour les autres paris). */
  push?: number;
  refundRule?: string;
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

/** « rembourse » : pari à ligne entière dont le total est tombé pile sur la ligne (ni gagné, ni perdu). */
export type Statut = "en_attente" | "gagne" | "perdu" | "rembourse";

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
