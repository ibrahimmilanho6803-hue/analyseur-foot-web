// Suggestions de clubs pendant la saisie (même logique que le site : src/suggest.js).
//
// Les règles de comparaison sont celles du serveur (src/teams.js) : minuscules, sans accents ni ponctuation, « & » = « and »,
// « utd » = « united », « st » = « saint ». Le serveur reste seul juge de la reconnaissance du nom saisi : ces suggestions aident à
// écrire le bon nom (celui qu'emploie la source de données), elles ne le remplacent pas.

export interface CatalogLeague {
  key: string;
  nom: string;
  pays?: string;
  charge?: boolean;
}

export interface CatalogTeam {
  nom: string;
  championnat?: string;
  noms?: string[];
}

/** Liste reçue de GET /api/teams. */
export interface Catalog {
  genereLe?: string;
  complet?: boolean;
  championnats?: CatalogLeague[] | null;
  equipes?: CatalogTeam[] | null;
}

interface IndexedName {
  raw: string;
  c: string;
  tokens: string[];
  official: boolean;
}

export interface IndexedTeam {
  nom: string;
  ligue: string;
  names: IndexedName[];
}

export interface Suggestion {
  nom: string;
  ligue: string;
  via: string | null;
}

const WORD: Record<string, string> = { utd: "united", st: "saint" };

// Forme comparable d'un nom : « Atlético  Madrid » → « atletico madrid », « Man Utd » → « man united ».
export function canon(s: unknown): string {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, " and ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => WORD[w] || w)
    .join(" ");
}

// Prépare la liste reçue de GET /api/teams : { championnats: [{ key, nom }], equipes: [{ nom, championnat, noms: [...] }] }.
// Les noms, déjà normalisés, sont calculés une fois pour toutes.
export function buildIndex(catalog: Catalog | null | undefined): IndexedTeam[] {
  const leagues = new Map(((catalog && catalog.championnats) || []).map((c) => [c.key, c.nom]));
  const teams: IndexedTeam[] = [];
  for (const t of (catalog && catalog.equipes) || []) {
    if (!t || typeof t.nom !== "string" || !t.nom.trim()) continue;
    const seen = new Set<string>();
    const names: IndexedName[] = [];
    [t.nom, ...(Array.isArray(t.noms) ? t.noms : [])].forEach((raw, i) => {
      const c = canon(raw);
      if (!c || seen.has(c)) return;
      seen.add(c);
      names.push({ raw: String(raw), c, tokens: c.split(" "), official: i === 0 });
    });
    if (names.length) teams.push({ nom: t.nom, ligue: (t.championnat && leagues.get(t.championnat)) || "", names });
  }
  return teams;
}

// Les mots saisis commencent, dans l'ordre, des mots du nom (« man c » → « manchester city »).
function prefixesInOrder(words: string[], tokens: string[]): boolean {
  let from = 0;
  for (const w of words) {
    let at = -1;
    for (let i = from; i < tokens.length; i++) {
      if (tokens[i].startsWith(w)) {
        at = i;
        break;
      }
    }
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}

// Ressemblance d'une saisie avec un nom, de 0 (aucune) à 1 (identique).
function scoreName(qc: string, qt: string[], n: IndexedName): number {
  if (n.c === qc) return 1;
  if (n.c.startsWith(qc)) return 0.9; // « paris s » → « paris sg »
  if (prefixesInOrder(qt, n.tokens)) return 0.85; // « man c » → « manchester city », « city » → « manchester city »
  if (qt.every((w) => n.tokens.some((t) => t.startsWith(w)))) return 0.75; // mots dans le désordre
  if (qc.length >= 3 && n.c.includes(qc)) return 0.6; // morceau de mot (« chester »)
  return 0;
}

// Distance entre deux mots : une insertion, une suppression, un remplacement ou l'échange de deux lettres voisines comptent pour 1.
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Faute de frappe : chaque mot saisi (4 lettres au moins) ressemble à un mot du nom, à une lettre près (deux pour un mot long),
// avec la même première lettre. N'est utilisé que si rien d'autre ne correspond.
function typoScore(qt: string[], n: IndexedName): number {
  let total = 0;
  for (const w of qt) {
    if (w.length < 4) return 0;
    let best = Infinity;
    for (const t of n.tokens) {
      if (t[0] !== w[0] || Math.abs(t.length - w.length) > 2) continue;
      best = Math.min(best, distance(w, t));
    }
    if (best > (w.length >= 8 ? 2 : 1)) return 0;
    total += best;
  }
  return 0.4 - 0.05 * total;
}

// Clubs qui correspondent à ce qui est tapé, du plus proche au moins proche : [{ nom, ligue, via }].
// `via` est l'écriture trouvée quand ce n'est pas le nom officiel (« PSG » pour « Paris SG »), sinon null.
export function suggest(index: IndexedTeam[] | null | undefined, query: unknown, { max = 6 }: { max?: number } = {}): Suggestion[] {
  const qc = canon(query);
  if (!Array.isArray(index) || qc.length < 2) return [];
  const qt = qc.split(" ");
  const pick = (score: (n: IndexedName) => number) => {
    const out: { team: IndexedTeam; via: string | null; s: number }[] = [];
    for (const team of index) {
      let best: { s: number; n: IndexedName } | null = null;
      for (const n of team.names) {
        const s = score(n);
        if (s > 0 && (!best || s > best.s || (s === best.s && n.official))) best = { s, n };
      }
      if (best) out.push({ team, via: best.n.official ? null : best.n.raw, s: best.s + (best.n.official ? 0.01 : 0) });
    }
    return out;
  };
  let found = pick((n) => scoreName(qc, qt, n));
  if (!found.length) found = pick((n) => typoScore(qt, n));
  found.sort((a, b) => b.s - a.s || a.team.nom.length - b.team.nom.length || a.team.nom.localeCompare(b.team.nom, "fr"));
  return found.slice(0, max).map(({ team, via }) => ({ nom: team.nom, ligue: team.ligue, via }));
}
