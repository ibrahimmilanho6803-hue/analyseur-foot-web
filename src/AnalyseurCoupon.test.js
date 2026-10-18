import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { asCross, asRefund, awaitsReview, callApi, crossLeagueNote, crossTotalNote, estimateProb, estimatesForChunk, fromTopMatch, mergeEstimates, refundNote, toEstimate } from "./AnalyseurCoupon";
import { CATALOG } from "./testData";

// ---------- Faux serveur : chaque appel est enregistré, aucun appel réseau réel ----------
// La liste des clubs (suggestions de saisie) est demandée au démarrage : par défaut elle est vide, et ses appels sont notés à part
// (`calls.catalog`) pour ne pas se mélanger à ceux que chaque test vérifie.
const EMPTY_CATALOG = { complet: true, championnats: [], equipes: [] };

function installFetch(routes) {
  const calls = [];
  calls.catalog = [];
  global.fetch = jest.fn((url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const call = { url: String(url), path, method, body: opts.body ? JSON.parse(opts.body) : undefined };
    if (method === "GET" && path === "/api/teams") {
      calls.catalog.push(call);
      if (!routes["GET /api/teams"]) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(EMPTY_CATALOG) });
    } else {
      calls.push(call);
    }
    const handler = routes[`${method} ${path}`];
    if (!handler) return Promise.reject(new Error(`appel inattendu : ${method} ${path}`));
    // Un gestionnaire peut renvoyer une promesse pour retenir la réponse (voir « deux temps » plus bas).
    return Promise.resolve(handler(opts.body ? JSON.parse(opts.body) : undefined)).then((out) => {
      if (out instanceof Error) throw out;
      const status = out.status || 200;
      return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(out.body) };
    });
  });
  return calls;
}

const inFuture = (hours) => new Date(Date.now() + hours * 3600000).toISOString();

const topEntry = (i, over = {}) => ({
  id: 100 + i,
  homeTeam: ["Arsenal", "Real Madrid", "Inter"][i],
  awayTeam: ["Chelsea", "Getafe", "Torino"][i],
  competition: ["Premier League", "Primera División", "Serie A"][i],
  date: inFuture(10 + i),
  meilleurPari: ["Plus de 1.5 buts", "Victoire ou nul équipe 1", "Plus de 0.5 buts"][i],
  probabilite: [78.4, 76.1, 83.9][i],
  probabiliteModele: [77, 75, 83][i],
  ajustementIA: 0.5,
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

const topPayload = (over = {}) => ({
  fenetreHeures: 72,
  avertissement: "Cotes estimées (1 ÷ probabilité), sans marge de bookmaker : les cotes réelles proposées par un opérateur seront plus basses.",
  complet: true,
  donnees: { championnatsPrets: ["PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "BSA"] },
  topMatches: [topEntry(0), topEntry(1), topEntry(2)],
  coteTotale: "2.66",
  probabiliteCombinee: 37.6,
  ia: { statut: "ok", modele: "claude-sonnet-5-5" },
  ...over,
});

const okLeg = (over = {}) => ({
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

// Comparaison renvoyée par le serveur quand les deux clubs ne jouent pas dans le même championnat (Ligue des champions…).
const CROSS_MESSAGE =
  "Ces deux clubs ne jouent pas dans le même championnat : leur niveau relatif est estimé grâce aux matchs de coupes d'Europe. Estimation moins précise qu'entre deux clubs d'un même championnat.";
const CROSS_WEAK_MESSAGE =
  "L'un de ces clubs ne joue dans aucun championnat suivi par l'application : son niveau n'est estimé que d'après ses matchs de coupes d'Europe. Estimation peu précise.";
const cross = (over = {}) => ({ championnat1: "Premier League", championnat2: "Liga", niveauDesChampionnatsMesure: true, message: CROSS_MESSAGE, ...over });
// Une analyse de Ligue des champions : Arsenal (Premier League) reçoit le Real Madrid (Liga).
const cupLeg = (over = {}) =>
  okLeg({ equipe1: "Arsenal", equipe2: "Real Madrid", competition: "UEFA Champions League", date: "2026-10-21T19:00:00.000Z", comparaisonEntreChampionnats: cross(), ...over });

// Remboursement annoncé par le serveur pour un pari à ligne entière (« Plus de 2 buts » : rendu quand le match se termine sur 2 buts).
const REFUND = { probabilite: 17.1, quand: "le match se termine avec exactement 2 buts au total" };
const REFUND_NOTE = "Remboursé si le match se termine avec exactement 2 buts au total (17.1 % de chances).";

async function openApp() {
  render(<App />);
  await screen.findByText("Analyseur Foot Pro");
}

// Le type de pari se choisit dans une fenêtre : on ouvre le champ, on cherche le pari par son nom, puis on le coche.
const openPicker = () => userEvent.click(screen.getByRole("button", { name: /^Type de pari :/ }));
const pickerDialog = () => screen.getByRole("dialog", { name: "Type de pari" });
function pickBet(bet) {
  openPicker();
  userEvent.type(within(pickerDialog()).getByLabelText("Rechercher un pari"), bet);
  userEvent.click(within(pickerDialog()).getByRole("radio", { name: bet }));
}

async function addMatch(home, away, bet) {
  userEvent.type(screen.getByLabelText("Équipe 1 (à domicile)"), home);
  userEvent.type(screen.getByLabelText("Équipe 2 (à l'extérieur)"), away);
  if (bet) pickBet(bet);
  userEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
  await screen.findByText(`${home} vs ${away}`);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete global.fetch;
});

// ---------- Fonctions pures ----------
describe("estimation d'une sélection", () => {
  const sel = { id: "a", typePari: "Plus de 1.5 buts" };
  const hist = (won, lost, label = "Plus de 1.5 buts") => [
    ...Array.from({ length: won }, (_, i) => ({ id: `w${i}`, typePari: label, statut: "gagne" })),
    ...Array.from({ length: lost }, (_, i) => ({ id: `l${i}`, typePari: label, statut: "perdu" })),
  ];

  test("l'analyse du serveur passe avant tout le reste", () => {
    const r = estimateProb(hist(10, 0), sel, { a: { p: 0.62 } });
    expect(r.p).toBe(0.62);
    expect(r.source).toBe("analyse");
  });

  test("sans analyse, l'historique est ramené vers la moyenne : 3 paris gagnés ne prouvent rien", () => {
    const r = estimateProb(hist(3, 0), sel, {});
    expect(r.source).toBe("historique");
    expect(r.p).toBeGreaterThan(0.75);
    expect(r.p).toBeLessThan(0.9);
  });

  test("moins de 3 paris clôturés : moyenne générale du type de pari", () => {
    const r = estimateProb(hist(2, 0), sel, {});
    expect(r.source).toBe("general");
    expect(r.p).toBe(0.75);
  });

  test("une analyse impossible (p nul) ne fournit jamais de probabilité : retour à la moyenne", () => {
    const r = estimateProb([], sel, { a: { p: null, message: "Équipe introuvable" } });
    expect(r.source).toBe("general");
  });

  test("les anciens libellés de l'historique comptent toujours", () => {
    const r = estimateProb(hist(5, 0, "Total buts 1.5 plus"), sel, {});
    expect(r.source).toBe("historique");
    expect(r.n).toBe(5);
  });
});

describe("lecture des réponses du serveur", () => {
  test("une analyse valide devient une probabilité bornée", () => {
    expect(toEstimate(okLeg({ probabilite: 62.3 })).p).toBeCloseTo(0.623, 5);
    expect(toEstimate(okLeg({ probabilite: 100 })).p).toBe(0.99);
    expect(toEstimate(okLeg({ probabilite: 0 })).p).toBe(0.01);
  });

  test("sans analyse chiffrée : p vaut null, avec le message et les suggestions du serveur", () => {
    const e = toEstimate({ etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable.", suggestions: { equipe1: ["Arsenal", "Aston Villa"], equipe2: [] } });
    expect(e.p).toBeNull();
    expect(e.message).toContain("Équipe introuvable.");
    expect(e.message).toContain("Arsenal, Aston Villa");
  });

  test("réponse absente : message clair, pas de probabilité", () => {
    expect(toEstimate(undefined).p).toBeNull();
    expect(toEstimate(null).message).toMatch(/Pas de réponse/);
  });

  test("un match du Top Matchs garde ses détails", () => {
    const e = fromTopMatch(topEntry(0));
    expect(e.p).toBeCloseTo(0.784, 5);
    expect(e.vigilance).toBe("Rotation possible");
    expect(e.statsEquipe1).toEqual({ forme: "VVNVV" });
    expect(fromTopMatch({}).p).toBeNull();
  });

  test("les réponses sont rattachées aux sélections dans l'ordre, et les relectures IA manquantes sont comptées", () => {
    const chunk = [{ id: "x" }, { id: "y" }, { id: "z" }];
    const { next, iaDown } = estimatesForChunk(chunk, [okLeg(), okLeg({ ia: { statut: "indisponible" } }), undefined]);
    expect(next.x.p).toBeCloseTo(0.623, 5);
    expect(iaDown).toBe(1);
    expect(next.z.p).toBeNull();
  });
});

describe("appel du serveur", () => {
  test("erreur du serveur : on affiche son message", async () => {
    installFetch({ "GET /api/x": () => ({ status: 429, body: { error: "Trop de demandes : réessayez dans 12 s." } }) });
    await expect(callApi("/api/x")).rejects.toThrow("Trop de demandes : réessayez dans 12 s.");
  });

  test("serveur injoignable : message lisible", async () => {
    installFetch({ "GET /api/x": () => new TypeError("Failed to fetch") });
    await expect(callApi("/api/x")).rejects.toThrow(/Impossible de joindre le serveur/);
  });

  test("délai dépassé : message lisible", async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn((url, opts) => new Promise((resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }));
      const request = callApi("/api/x", { timeoutMs: 1000 });
      jest.advanceTimersByTime(1001);
      await expect(request).rejects.toThrow(/trop de temps/);
    } finally {
      jest.useRealTimers();
    }
  });

  test("réponse sans JSON : l'état HTTP est indiqué", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error("pas de json")) }));
    await expect(callApi("/api/x")).rejects.toThrow("Erreur 502");
  });
});

// ---------- Parcours dans l'application ----------
describe("onglet Top Matchs", () => {
  test("affiche les 3 matchs, la cote combinée estimée et l'avertissement sur les cotes", async () => {
    const calls = installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Real Madrid vs Getafe")).toBeInTheDocument();
    expect(screen.getByText("Inter vs Torino")).toBeInTheDocument();
    expect(screen.getByText("78.4 %")).toBeInTheDocument();
    expect(screen.getByText("2.66")).toBeInTheDocument();
    expect(screen.getByText(/Cotes estimées \(1 ÷ probabilité\)/)).toBeInTheDocument(); // avertissement envoyé par le serveur
    expect(screen.getByText(/Analyse de 8 championnats/)).toBeInTheDocument();
    expect(calls.filter((c) => c.path === "/api/top-matches")).toHaveLength(1);
  });

  test("ne recharge pas à chaque passage sur l'onglet", async () => {
    const calls = installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    userEvent.click(screen.getByRole("button", { name: "Mon coupon" }));
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(calls).toHaveLength(1);
  });

  test("IA indisponible : le site le dit clairement", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ ia: { statut: "indisponible", modele: "claude-sonnet-5-5" } }) }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText(/modèle statistique seul/);
  });

  test("erreur du serveur : message clair et possibilité de réessayer", async () => {
    installFetch({ "GET /api/top-matches": () => ({ status: 503, body: { error: "Aucune source de données n'est disponible pour le moment." } }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText(/Aucune source de données n'est disponible pour le moment\./);
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeInTheDocument();
  });

  test("ajouter un match au coupon, une seule fois, avec sa probabilité déjà connue", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    userEvent.click(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    expect(screen.getByRole("button", { name: "Déjà dans le coupon" })).toBeDisabled();
    userEvent.click(screen.getByRole("button", { name: "Mon coupon" }));
    expect(screen.getAllByText("78 %").length).toBeGreaterThan(0);
    expect(screen.queryByText("Estimation indicative")).not.toBeInTheDocument(); // l'analyse du serveur est déjà là
    expect(screen.queryByText(/pas d'analyse chiffrée/)).not.toBeInTheDocument();
  });
});

describe("onglet Mon coupon", () => {
  test("avant l'analyse, le pourcentage est présenté comme indicatif", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    expect(screen.getByText("Estimation indicative")).toBeInTheDocument();
    expect(screen.getByText(/n'a pas d'analyse chiffrée/)).toBeInTheDocument();
    expect(screen.getByText(/Moyenne générale de ce pari/)).toBeInTheDocument();
  });

  test("analyse : une seule requête groupée vers /api/analyze, jamais vers l'ancienne route", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg(), okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Match nul", probabilite: 21.4 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Match nul");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText("62 %");
    expect(screen.getByText("21 %")).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://analyseur-foot-api.onrender.com/api/analyze");
    expect(calls[0].body).toEqual({
      ia: false, // d'abord le modèle seul ; ce serveur répond déjà avec l'IA, il n'y a donc rien à relancer
      legs: [
        { equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" },
        { equipe1: "Inter", equipe2: "Torino", typePari: "Match nul" },
      ],
    });
    expect(screen.getByText(/Cote équitable estimée/)).toBeInTheDocument();
    expect(screen.queryByText("Estimation indicative")).not.toBeInTheDocument();
    expect(calls.some((c) => /analyze-simple/.test(c.url))).toBe(false);
  });

  test("équipe introuvable : point d'interrogation, message du serveur, aucune probabilité inventée", async () => {
    installFetch({
      "POST /api/analyze": () => ({
        body: { legs: [{ etat: "equipe_inconnue", probabilite: null, donneesInsuffisantes: true, message: "Équipe introuvable : vérifiez l'orthographe.", suggestions: { equipe1: ["Arsenal"], equipe2: [] } }] },
      }),
    });
    await openApp();
    await addMatch("Arsnal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText(/Équipe introuvable : vérifiez l'orthographe\. Suggestions : Arsenal\./);
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Estimation indicative")).toBeInTheDocument();
  });

  test("IA indisponible côté serveur : la sélection reste affichée avec un avis clair", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ ia: { statut: "indisponible", code: "TIMEOUT", message: "délai dépassé" } })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText(/relecture par l'IA était indisponible/)).toBeInTheDocument();
    expect(screen.getAllByText("62 %")).toHaveLength(2); // la sélection et le total du coupon
  });

  test("serveur injoignable : erreur lisible, le coupon est conservé", async () => {
    installFetch({ "POST /api/analyze": () => new TypeError("Failed to fetch") });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText(/Analyse impossible : Impossible de joindre le serveur/);
    expect(screen.getByText("Arsenal vs Chelsea")).toBeInTheDocument();
  });

  test("deux paris sur le même match : avertissement sur la combinaison", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    expect(screen.queryByText(/portent sur le même match/)).not.toBeInTheDocument();
    userEvent.type(screen.getByLabelText("Équipe 1 (à domicile)"), "arsenal");
    userEvent.type(screen.getByLabelText("Équipe 2 (à l'extérieur)"), "CHELSEA");
    userEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    await screen.findByText(/portent sur le même match/);
  });

  test("enregistrer le coupon le place dans l'historique", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Match nul");
    userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    userEvent.click(screen.getByRole("button", { name: "Historique" }));
    await screen.findByText("Arsenal vs Chelsea - Match nul");
    expect(JSON.parse(localStorage.getItem("coupon-pronostics"))).toHaveLength(1);
  });
});

describe("onglet Auto", () => {
  const typeMatch = (home, away) => {
    userEvent.type(screen.getByLabelText("Équipe 1 du match à générer"), home);
    userEvent.type(screen.getByLabelText("Équipe 2 du match à générer"), away);
    userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
  };

  test("génère le coupon avec /api/auto-coupon et ouvre « Mon coupon »", async () => {
    const calls = installFetch({
      "POST /api/auto-coupon": () => ({
        body: {
          resultats: [
            { index: 0, ...okLeg({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Victoire ou nul équipe 1", probabilite: 79.2 }) },
            { index: 1, ...okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Plus de 0.5 buts", probabilite: 91.0 }) },
          ],
          analyses: 2,
          probabiliteCombinee: 72.1,
          coteTotale: "1.39",
          avertissement: "Cotes estimées",
        },
      }),
    });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    typeMatch("Arsenal", "Chelsea");
    typeMatch("Inter", "Torino");
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText("Coupon (2 matchs)");
    expect(screen.getByText("Victoire ou nul équipe 1")).toBeInTheDocument(); // le pari choisi par le serveur, sur la carte du match
    expect(screen.getByText("Plus de 0.5 buts")).toBeInTheDocument();
    expect(screen.getByText("79 %")).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/api/auto-coupon");
    expect(calls[0].body).toEqual({ matches: [{ equipe1: "Arsenal", equipe2: "Chelsea" }, { equipe1: "Inter", equipe2: "Torino" }] });
    expect(calls.some((c) => /analyze-simple|anthropic/i.test(c.url))).toBe(false);
  });

  test("résultat partiel : les matchs réussis sont ajoutés, les autres expliqués et conservés", async () => {
    installFetch({
      "POST /api/auto-coupon": () => ({
        body: {
          resultats: [
            { index: 0, ...okLeg({ typePari: "Victoire ou nul équipe 1", probabilite: 79.2 }) },
            { index: 1, etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable : vérifiez l'orthographe.", suggestions: { equipe1: [], equipe2: [] } },
          ],
          analyses: 1,
        },
      }),
    });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    typeMatch("Arsenal", "Chelsea");
    typeMatch("Xyz", "Abc");
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText(/1 pronostic ajouté à « Mon coupon »/);
    expect(screen.getByText(/Xyz vs Abc : Équipe introuvable/)).toBeInTheDocument();
    expect(screen.getByText("Xyz vs Abc")).toBeInTheDocument(); // reste dans la liste pour être corrigé
    userEvent.click(screen.getByRole("button", { name: "Voir mon coupon" }));
    expect(await screen.findByText("Coupon (1 match)")).toBeInTheDocument();
  });

  test("serveur en erreur : message affiché, la liste des matchs est conservée", async () => {
    installFetch({ "POST /api/auto-coupon": () => ({ status: 429, body: { error: "Trop de demandes : réessayez dans 30 s." } }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    typeMatch("Arsenal", "Chelsea");
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText("Trop de demandes : réessayez dans 30 s.");
    expect(screen.getByText("Arsenal vs Chelsea")).toBeInTheDocument();
  });

  test("douze matchs au maximum", async () => {
    installFetch({});
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    for (let i = 0; i < 12; i += 1) typeMatch(`Domicile${i}`, `Visiteur${i}`);
    typeMatch("Trop", "Loin");
    await screen.findByText(/12 matchs au maximum/);
    expect(screen.queryByText("Trop vs Loin")).not.toBeInTheDocument();
  });
});

// ---------- Suggestions de clubs ----------
const withCatalog = (over = {}) => ({ "GET /api/teams": () => ({ body: { ...CATALOG, ...over } }) });
const savedCatalog = () => JSON.parse(localStorage.getItem("coupon-clubs"));
const seedCatalog = (ageMs, over = {}) => localStorage.setItem("coupon-clubs", JSON.stringify({ v: 2, at: Date.now() - ageMs, data: { ...CATALOG, ...over } }));
const team1 = () => screen.getByLabelText("Équipe 1 (à domicile)");
const team2 = () => screen.getByLabelText("Équipe 2 (à l'extérieur)");
const suggestionOptions = () => within(screen.getByRole("listbox", { name: "Suggestions de clubs" })).getAllByRole("option");

describe("liste des clubs", () => {
  test("demandée au démarrage au serveur, puis gardée sur l'appareil", async () => {
    const calls = installFetch(withCatalog());
    await openApp();
    await waitFor(() => expect(savedCatalog()).not.toBeNull());
    expect(calls.catalog).toHaveLength(1);
    expect(calls.catalog[0].url).toBe("https://analyseur-foot-api.onrender.com/api/teams");
    expect(savedCatalog().data.equipes).toHaveLength(CATALOG.equipes.length);
  });

  test("liste complète récente : pas de nouvelle demande, et les suggestions marchent tout de suite", async () => {
    seedCatalog(3600000);
    const calls = installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    expect(screen.getByRole("option", { name: /Paris SG/ })).toBeInTheDocument(); // sans attendre le réseau
    userEvent.click(team2());
    expect(calls.catalog).toHaveLength(0);
  });

  test("liste complète de plus de 24 h : redemandée, l'ancienne sert en attendant", async () => {
    seedCatalog(25 * 3600000);
    const calls = installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    expect(screen.getByRole("option", { name: /Paris SG/ })).toBeInTheDocument();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
  });

  test("liste incomplète (championnats en chargement) : redemandée dès qu'elle a plus d'une minute", async () => {
    seedCatalog(2 * 60000, { complet: false, equipes: CATALOG.equipes.slice(0, 3) });
    const calls = installFetch(withCatalog());
    await openApp();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
    await waitFor(() => expect(savedCatalog().data.complet).toBe(true));
    userEvent.type(team1(), "psg");
    expect(await screen.findByRole("option", { name: /Paris SG/ })).toBeInTheDocument();
  });

  test("liste incomplète de moins d'une minute : on ne harcèle pas le serveur", async () => {
    seedCatalog(10000, { complet: false, equipes: CATALOG.equipes.slice(0, 3) });
    const calls = installFetch(withCatalog());
    await openApp();
    userEvent.click(team1());
    userEvent.click(team2());
    expect(calls.catalog).toHaveLength(0);
  });

  test("serveur injoignable : champs texte ordinaires, aucune erreur affichée, un seul essai par minute", async () => {
    const calls = installFetch({ "GET /api/teams": () => new TypeError("Failed to fetch") });
    await openApp();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
    userEvent.type(team1(), "psg");
    userEvent.click(team2());
    userEvent.click(team1());
    expect(calls.catalog).toHaveLength(1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(team1()).toHaveValue("psg");
    expect(screen.queryByText(/Impossible de joindre/)).not.toBeInTheDocument();
    userEvent.clear(team1());
    await addMatch("psg", "om", "Match nul"); // le coupon se construit comme avant
  });

  test("liste abîmée dans le stockage de l'appareil : ignorée", async () => {
    localStorage.setItem("coupon-clubs", "{pas du json");
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    expect(await screen.findByRole("option", { name: /Paris SG/ })).toBeInTheDocument();
  });
});

describe("saisie d'un club avec suggestions", () => {
  test("un surnom propose le club ; un clic le choisit", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    const option = await screen.findByRole("option", { name: /Paris SG/ });
    expect(within(option).getByText("PSG · Ligue 1")).toBeInTheDocument();
    expect(team1()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Suggestions de clubs" })).toBeInTheDocument();
    userEvent.click(option);
    expect(team1()).toHaveValue("Paris SG");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(team1()).toHaveAttribute("aria-expanded", "false");
  });

  test("les deux champs sont indépendants et le coupon reçoit les noms choisis", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    userEvent.click(await screen.findByRole("option", { name: /Paris SG/ }));
    userEvent.type(team2(), "om");
    userEvent.click(await screen.findByRole("option", { name: /Marseille/ }));
    expect(team1()).toHaveValue("Paris SG");
    expect(team2()).toHaveValue("Marseille");
    userEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    expect(await screen.findByText("Paris SG vs Marseille")).toBeInTheDocument();
  });

  test("clavier : flèches pour parcourir, Entrée pour choisir, Échap pour fermer", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "man");
    await screen.findByRole("listbox");
    const options = suggestionOptions();
    expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Manchester City"), expect.stringContaining("Manchester United")]));
    expect(team1()).not.toHaveAttribute("aria-activedescendant");
    userEvent.type(team1(), "{arrowdown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(team1()).toHaveAttribute("aria-activedescendant", options[0].id);
    userEvent.type(team1(), "{arrowdown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    userEvent.type(team1(), "{arrowup}{arrowup}"); // remonte, puis revient à la dernière
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
    userEvent.type(team1(), "{arrowdown}{arrowdown}");
    userEvent.type(team1(), "{enter}");
    expect(team1().value).toMatch(/^Manchester /);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    userEvent.clear(team1());
    userEvent.type(team1(), "ars");
    await screen.findByRole("option", { name: /Arsenal/ });
    userEvent.type(team1(), "{esc}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(team1()).toHaveValue("ars"); // Échap ne change pas la saisie
    userEvent.type(team1(), "e"); // reprendre la saisie rouvre la liste
    expect(await screen.findByRole("option", { name: /Arsenal/ })).toBeInTheDocument();
  });

  test("Entrée sans suggestion sélectionnée ne choisit rien", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "man{enter}");
    expect(team1()).toHaveValue("man");
  });

  test("un nom commun à plusieurs clubs les propose tous (jamais un seul au hasard)", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "paris");
    await screen.findByRole("listbox");
    const names = suggestionOptions().map((o) => o.textContent);
    expect(names.some((n) => n.startsWith("Paris SG"))).toBe(true);
    expect(names.some((n) => n.startsWith("Paris FC"))).toBe(true);
  });

  test("aucun club ne correspond : message d'aide, la saisie libre reste possible", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "Zzzzzz");
    expect(await screen.findByText(/Aucun club suivi ne correspond/)).toBeInTheDocument();
    expect(team1()).toHaveValue("Zzzzzz");
    userEvent.clear(team1());
    await addMatch("Zzzzzz", "Yyyyyy", "Match nul");
  });

  test("liste incomplète : le message d'aide dit que des championnats chargent encore", async () => {
    installFetch(withCatalog({ complet: false }));
    await openApp();
    userEvent.type(team1(), "Zzzzzz");
    expect(await screen.findByText(/certains championnats sont encore en chargement/)).toBeInTheDocument();
  });

  test("perdre le focus ferme la liste", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.type(team1(), "psg");
    await screen.findByRole("listbox");
    userEvent.click(team2());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("onglet Auto : les mêmes suggestions", async () => {
    installFetch(withCatalog());
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    userEvent.type(screen.getByLabelText("Équipe 1 du match à générer"), "bay");
    userEvent.click(await screen.findByRole("option", { name: /Bayern Munich/ }));
    userEvent.type(screen.getByLabelText("Équipe 2 du match à générer"), "bvb");
    userEvent.click(await screen.findByRole("option", { name: /Borussia Dortmund/ }));
    userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    expect(await screen.findByText("Bayern Munich vs Borussia Dortmund")).toBeInTheDocument();
  });
});

// ---------- Noms reconnus par le serveur ----------
const parisLeg = (over = {}) => okLeg({ equipe1: "Paris SG", equipe2: "Marseille", competition: "Ligue 1", date: "2026-10-18T19:45:00.000Z", ...over });

describe("noms reconnus", () => {
  test("lecture des réponses : noms, championnat et date sont conservés", () => {
    const e = toEstimate(parisLeg());
    expect(e).toMatchObject({ equipe1: "Paris SG", equipe2: "Marseille", competition: "Ligue 1", date: "2026-10-18T19:45:00.000Z" });
    expect(fromTopMatch(topEntry(0))).toMatchObject({ equipe1: "Arsenal", equipe2: "Chelsea", competition: "Premier League" });
  });

  test("après l'analyse, le coupon affiche le nom reconnu, le championnat et rappelle la saisie", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg()] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    expect(screen.queryByText("Saisi : PSG – OM")).not.toBeInTheDocument(); // rien avant l'analyse
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText("Paris SG vs Marseille")).toBeInTheDocument();
    expect(screen.getByText("Saisi : PSG – OM")).toBeInTheDocument();
    expect(screen.getByText(/^Ligue 1 · /)).toBeInTheDocument();
    expect(screen.queryByText("PSG vs OM")).not.toBeInTheDocument();
  });

  test("pas de rappel de la saisie quand le nom reconnu n'est que sa version complète (« Arsenal » → « Arsenal FC »)", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ equipe1: "Arsenal FC", equipe2: "Chelsea FC" })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText("Arsenal FC vs Chelsea FC")).toBeInTheDocument();
    expect(screen.queryByText(/^Saisi :/)).not.toBeInTheDocument();
  });

  test("deux écritures d'un même match sont reconnues comme le même match une fois analysées", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg(), parisLeg({ typePari: "Match nul", probabilite: 24 })] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    await addMatch("Paris Saint-Germain", "Olympique de Marseille", "Match nul");
    expect(screen.queryByText(/portent sur le même match/)).not.toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findAllByText("Paris SG vs Marseille");
    expect(await screen.findByText(/portent sur le même match/)).toBeInTheDocument();
  });

  test("l'historique garde les noms reconnus", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg()] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText("Paris SG vs Marseille");
    userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    userEvent.click(screen.getByRole("button", { name: "Historique" }));
    expect(await screen.findByText("Paris SG vs Marseille - Plus de 1.5 buts")).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem("coupon-pronostics"));
    expect(saved[0]).toMatchObject({ equipe1: "Paris SG", equipe2: "Marseille" });
  });

  test("un match du Top Matchs ajouté au coupon montre son championnat", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    userEvent.click(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    userEvent.click(screen.getByRole("button", { name: "Mon coupon" }));
    expect(screen.getByText(/^Premier League · /)).toBeInTheDocument();
  });
});

// ---------- Analyse en deux temps ----------
const quick = (over = {}) => okLeg({ probabilite: 60, ajustementIA: 0, justification: "Texte du modèle.", ia: { statut: "non_demandee" }, ...over });
const reviewed = (over = {}) => okLeg({ probabilite: 62.5, ajustementIA: 2.5, justification: "Texte relu par l'IA.", ia: { statut: "ok", modele: "claude-sonnet-5-5" }, ...over });
const analyzeCalls = (calls) => calls.filter((c) => c.path === "/api/analyze");

describe("analyse en deux temps", () => {
  test("le modèle s'affiche tout de suite, la relecture de l'IA vient ensuite l'ajuster", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const calls = installFetch({
      "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : gate.then(() => ({ body: { legs: [reviewed()] } }))),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    // Temps 1 : le résultat du modèle, sans attendre l'IA
    expect((await screen.findAllByText("60 %")).length).toBeGreaterThan(0);
    expect(screen.getByText(/la relecture par l'IA est en cours/)).toBeInTheDocument();
    expect(screen.queryByText("Estimation indicative")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyse…/ })).toBeDisabled();
    // Temps 2 : la relecture arrive
    release();
    expect((await screen.findAllByText("63 %")).length).toBeGreaterThan(0); // 62,5 arrondi
    expect(screen.queryByText("60 %")).not.toBeInTheDocument();
    expect(screen.queryByText(/la relecture par l'IA est en cours/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyser/ })).toBeEnabled();
    const posts = analyzeCalls(calls);
    expect(posts).toHaveLength(2);
    expect(posts[0].body).toEqual({ ia: false, legs: [{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }] });
    expect(posts[1].body).toEqual({ legs: [{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }] }); // sans « ia: false »
  });

  test("les détails montrent le texte de l'IA une fois la relecture arrivée", async () => {
    installFetch({ "POST /api/analyze": (body) => ({ body: { legs: [body.ia === false ? quick() : reviewed()] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findAllByText("63 %");
    userEvent.click(screen.getByRole("button", { name: "Détails" }));
    expect(screen.getByText("Texte relu par l'IA.")).toBeInTheDocument();
    expect(screen.queryByText("Texte du modèle.")).not.toBeInTheDocument();
  });

  test("seules les sélections qui attendent l'IA sont relancées (un score exact n'en a pas besoin)", async () => {
    const calls = installFetch({
      "POST /api/analyze": (body) =>
        body.ia === false
          ? { body: { legs: [quick(), quick({ equipe1: "Inter", equipe2: "Torino", typePari: "Score exact", probabilite: 11, ia: { statut: "non_applicable" } })] } }
          : { body: { legs: [reviewed()] } },
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Score exact");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findAllByText("63 %");
    expect(screen.getByText("11 %")).toBeInTheDocument();
    const posts = analyzeCalls(calls);
    expect(posts).toHaveLength(2);
    expect(posts[1].body.legs).toEqual([{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }]);
  });

  test("la relecture échoue : le résultat du modèle reste affiché, avec la raison", async () => {
    installFetch({
      "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : { status: 429, body: { error: "Trop de demandes : réessayez dans 12 s." } }),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText(/La relecture par l'IA n'a pas pu être faite \(Trop de demandes : réessayez dans 12 s\.\) : le modèle statistique répond seul\./)).toBeInTheDocument();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Analyse impossible/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyser/ })).toBeEnabled();
  });

  test("le serveur tombe pendant la relecture : même résultat, le modèle reste affiché", async () => {
    installFetch({
      "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : new TypeError("Failed to fetch")),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText(/La relecture par l'IA n'a pas pu être faite \(Impossible de joindre le serveur/)).toBeInTheDocument();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
  });

  test("la relecture est indisponible côté serveur : le modèle reste, avec l'avis habituel", async () => {
    installFetch({
      "POST /api/analyze": (body) => ({ body: { legs: [body.ia === false ? quick() : reviewed({ probabilite: 60, ajustementIA: 0, ia: { statut: "indisponible", code: "TIMEOUT", message: "délai dépassé" } })] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText(/relecture par l'IA était indisponible pour une sélection/)).toBeInTheDocument();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
  });

  test("IA désactivée sur le serveur : une seule requête, rien à relancer", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ body: { legs: [quick({ ia: { statut: "desactivee" } })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findAllByText("60 %");
    expect(analyzeCalls(calls)).toHaveLength(1);
  });

  test("la relecture ne remplace jamais une probabilité par un échec", async () => {
    installFetch({
      "POST /api/analyze": (body) =>
        body.ia === false
          ? { body: { legs: [quick()] } }
          : { body: { legs: [{ etat: "chargement", probabilite: null, message: "Les données des championnats sont en cours de chargement, réessayez dans une minute." }] } },
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Analyser/ })).toBeEnabled());
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  test("premier temps en échec : message d'erreur comme avant, aucune relecture tentée", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ status: 503, body: { error: "Aucune source de données n'est disponible pour le moment." } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText(/Analyse impossible : Aucune source de données n'est disponible/);
    expect(analyzeCalls(calls)).toHaveLength(1);
  });

  test("plus de douze sélections : chaque temps se fait par séries de douze", async () => {
    const calls = installFetch({
      "POST /api/analyze": (body) => ({ body: { legs: body.legs.map((l) => (body.ia === false ? quick({ equipe1: l.equipe1, equipe2: l.equipe2 }) : reviewed({ equipe1: l.equipe1, equipe2: l.equipe2 }))) } }),
    });
    await openApp();
    for (let i = 0; i < 13; i += 1) await addMatch(`Dom${i}`, `Ext${i}`, "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await waitFor(() => expect(screen.getAllByText("63 %").length).toBeGreaterThan(12), { timeout: 5000 });
    const sizes = analyzeCalls(calls).map((c) => [c.body.ia === false ? "modele" : "ia", c.body.legs.length]);
    expect(sizes).toEqual([["modele", 12], ["modele", 1], ["ia", 12], ["ia", 1]]);
  }, 15000);
});

describe("fusion des estimations", () => {
  test("une probabilité n'est jamais remplacée par un échec, mais un échec peut remplacer un échec", () => {
    const prev = { a: { p: 0.6 }, b: { p: null, message: "ancien" } };
    const out = mergeEstimates(prev, { a: { p: null, message: "échec" }, b: { p: null, message: "nouveau" }, c: { p: 0.5 }, d: { p: null, message: "x" } });
    expect(out.a.p).toBe(0.6);
    expect(out.b.message).toBe("nouveau");
    expect(out.c.p).toBe(0.5);
    expect(out.d.message).toBe("x");
    expect(prev.a.p).toBe(0.6); // l'original n'est pas modifié
  });

  test("une réponse attend la relecture de l'IA seulement si elle est valide et sans IA demandée", () => {
    expect(awaitsReview(quick())).toBe(true);
    expect(awaitsReview(okLeg())).toBe(false);
    expect(awaitsReview(quick({ ia: { statut: "desactivee" } }))).toBe(false);
    expect(awaitsReview(quick({ ia: { statut: "non_applicable" } }))).toBe(false);
    expect(awaitsReview({ etat: "equipe_inconnue", ia: { statut: "non_demandee" } })).toBe(false);
    expect(awaitsReview(undefined)).toBe(false);
  });
});

// ---------- Clubs de championnats différents (Ligue des champions, autres championnats) ----------
describe("clubs de championnats différents", () => {
  const quickLeg = (over = {}) => okLeg({ probabilite: 60, ajustementIA: 0, justification: "Texte du modèle.", ia: { statut: "non_demandee" }, ...over });
  const reviewedLeg = (over = {}) => okLeg({ probabilite: 62.5, ajustementIA: 2.5, justification: "Texte relu par l'IA.", ia: { statut: "ok", modele: "claude-sonnet-5-5" }, ...over });

  test("la comparaison du serveur est gardée avec l'estimation (analyse, Auto et Top Matchs)", () => {
    expect(toEstimate(cupLeg()).crossLeague).toEqual(cross());
    expect(fromTopMatch(topEntry(0, { comparaisonEntreChampionnats: cross() })).crossLeague).toEqual(cross());
    expect(toEstimate(cupLeg()).p).toBeCloseTo(0.623, 5);
  });

  test("deux clubs du même championnat, ou serveur plus ancien : rien à signaler", () => {
    expect(toEstimate(okLeg()).crossLeague).toBeUndefined();
    expect(toEstimate(okLeg({ comparaisonEntreChampionnats: null })).crossLeague).toBeUndefined();
    expect(fromTopMatch(topEntry(0)).crossLeague).toBeUndefined();
    expect(toEstimate(okLeg({ comparaisonEntreChampionnats: "oui" })).crossLeague).toBeUndefined();
    expect(asCross([cross()])).toBeUndefined();
  });

  test("l'avertissement affiché est celui du serveur, ou à défaut une phrase générale", () => {
    expect(crossLeagueNote(cross())).toBe(CROSS_MESSAGE);
    expect(crossLeagueNote(cross({ message: CROSS_WEAK_MESSAGE }))).toBe(CROSS_WEAK_MESSAGE);
    expect(crossLeagueNote({ championnat1: "Premier League" })).toMatch(/ne jouent pas dans le même championnat/);
    expect(crossLeagueNote({ message: "   " })).toMatch(/estimation moins précise/);
    expect(crossLeagueNote(undefined)).toBeNull();
    expect(crossTotalNote(1)).toMatch(/^1 sélection oppose/);
    expect(crossTotalNote(3)).toMatch(/^3 sélections opposent/);
  });

  test("Mon coupon : l'avertissement du serveur est visible sous le pari concerné, et le total le rappelle", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [cupLeg(), okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Match nul", probabilite: 30 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Match nul");
    expect(screen.queryByText(CROSS_MESSAGE)).not.toBeInTheDocument(); // rien avant l'analyse
    userEvent.click(screen.getByRole("button", { name: "Analyser" }));
    expect(await screen.findByText(CROSS_MESSAGE)).toBeInTheDocument(); // sans avoir ouvert « Détails »
    expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1); // Inter – Torino n'est pas concerné
    expect(screen.getByText(/^UEFA Champions League · /)).toBeInTheDocument();
    expect(screen.getByText("1 sélection oppose des clubs de championnats différents : son estimation est moins précise, le pourcentage combiné aussi.")).toBeInTheDocument();
  });

  test("deux sélections concernées : le total le dit au pluriel, chaque pari garde son texte", async () => {
    installFetch({
      "POST /api/analyze": () => ({
        body: { legs: [cupLeg(), cupLeg({ equipe1: "Inter", equipe2: "Benfica", typePari: "Match nul", probabilite: 30, comparaisonEntreChampionnats: cross({ message: CROSS_WEAK_MESSAGE }) })] },
      }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Inter", "Benfica", "Match nul");
    userEvent.click(screen.getByRole("button", { name: "Analyser" }));
    expect(await screen.findByText(CROSS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(CROSS_WEAK_MESSAGE)).toBeInTheDocument(); // le texte du serveur, tel quel (club d'un championnat non suivi)
    expect(screen.getByText(/2 sélections opposent des clubs de championnats différents/)).toBeInTheDocument();
  });

  test("la relecture de l'IA ne fait pas disparaître l'avertissement", async () => {
    installFetch({
      "POST /api/analyze": (body) => ({ body: { legs: [body.ia === false ? quickLeg({ comparaisonEntreChampionnats: cross() }) : reviewedLeg({ comparaisonEntreChampionnats: cross() })] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: "Analyser" }));
    await screen.findAllByText("63 %"); // relecture arrivée
    expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1);
  });

  test("deux clubs du même championnat : aucun avertissement de ce genre", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg()] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: "Analyser" }));
    await screen.findAllByText("62 %");
    expect(screen.queryByText(/oppos(e|ent) des clubs de championnats différents/)).not.toBeInTheDocument(); // la mise en garde sur le total
    expect(screen.queryByText(/ne jouent pas dans le même championnat/)).not.toBeInTheDocument(); // celle du pari
  });

  test("une sélection dont l'analyse a échoué ne compte pas parmi celles à signaler", async () => {
    installFetch({
      "POST /api/analyze": () => ({ body: { legs: [cupLeg(), { etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable : vérifiez l'orthographe.", suggestions: { equipe1: [], equipe2: [] } }] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Xyz", "Abc", "Match nul");
    userEvent.click(screen.getByRole("button", { name: "Analyser" }));
    await screen.findByText(/Équipe introuvable/);
    expect(screen.getByText(/^1 sélection oppose des clubs/)).toBeInTheDocument();
  });

  test("les écrans le disent : les deux clubs peuvent venir de championnats différents", async () => {
    installFetch({});
    await openApp();
    expect(screen.getByText(/Les deux clubs peuvent venir de championnats différents \(Ligue des champions, par exemple\)/)).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(screen.getByText(/Les deux clubs peuvent venir de championnats différents \(Ligue des champions, par exemple\)/)).toBeInTheDocument();
  });

  test("Auto : un match de Ligue des champions est analysé et ajouté au coupon avec son avertissement", async () => {
    const calls = installFetch({
      "POST /api/auto-coupon": () => ({ body: { resultats: [{ index: 0, ...cupLeg({ typePari: "Victoire ou nul équipe 1", probabilite: 66.4 }) }], analyses: 1 } }),
    });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    userEvent.type(screen.getByLabelText("Équipe 1 du match à générer"), "Arsenal");
    userEvent.type(screen.getByLabelText("Équipe 2 du match à générer"), "Real Madrid");
    userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText("Coupon (1 match)");
    expect(calls[0].body).toEqual({ matches: [{ equipe1: "Arsenal", equipe2: "Real Madrid" }] });
    expect(screen.getByText(/^UEFA Champions League · /)).toBeInTheDocument();
    expect(screen.getByText(CROSS_MESSAGE)).toBeInTheDocument();
  });

  describe("Top Matchs", () => {
    const leagues = ["PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "BSA"];
    const openTop = async (payload) => {
      installFetch({ "GET /api/top-matches": () => ({ body: payload }) });
      await openApp();
      userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    };

    test("le sous-titre compte aussi les coupes d'Europe analysées", async () => {
      await openTop(topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: ["CL", "EL", "UECL"] } }));
      expect(await screen.findByText(/Analyse de 8 championnats et 3 coupes d'Europe, matchs des 72 prochaines heures/)).toBeInTheDocument();
    });

    test("une seule coupe : singulier ; aucune coupe : la phrase d'avant", async () => {
      await openTop(topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: ["CL"] } }));
      expect(await screen.findByText(/Analyse de 8 championnats et 1 coupe d'Europe, matchs/)).toBeInTheDocument();
    });

    test("sans coupe annoncée, le sous-titre ne parle pas de coupes", async () => {
      await openTop(topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: [] } }));
      expect(await screen.findByText(/Analyse de 8 championnats, matchs des 72 prochaines heures/)).toBeInTheDocument();
      expect(screen.queryByText(/coupe/)).not.toBeInTheDocument();
    });

    test("un match de coupe entre deux championnats porte l'avertissement du serveur, et le garde dans le coupon", async () => {
      await openTop(topPayload({ topMatches: [topEntry(0, { competition: "UEFA Champions League", comparaisonEntreChampionnats: cross() }), topEntry(1), topEntry(2)] }));
      await screen.findByText("Arsenal vs Chelsea");
      expect(screen.getByText("UEFA Champions League")).toBeInTheDocument();
      expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1); // seul ce match est concerné
      userEvent.click(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
      userEvent.click(screen.getByRole("button", { name: "Mon coupon" }));
      expect(screen.getByText(CROSS_MESSAGE)).toBeInTheDocument();
      expect(screen.getByText(/^1 sélection oppose des clubs de championnats différents/)).toBeInTheDocument();
    });
  });

  describe("liste des clubs", () => {
    test("liste enregistrée par une ancienne version : ignorée, la liste actuelle est demandée", async () => {
      // Ancien format (sans numéro de version) : seulement quelques clubs des championnats principaux, enregistrée il y a une heure.
      localStorage.setItem("coupon-clubs", JSON.stringify({ at: Date.now() - 3600000, data: { ...CATALOG, equipes: CATALOG.equipes.slice(0, 3) } }));
      const calls = installFetch(withCatalog());
      await openApp();
      await waitFor(() => expect(calls.catalog).toHaveLength(1));
      userEvent.type(team1(), "benf");
      expect(await screen.findByRole("option", { name: /Benfica/ })).toBeInTheDocument();
    });

    test("un club d'un autre championnat, ou connu seulement par les coupes d'Europe, est proposé avec son championnat", async () => {
      installFetch(withCatalog());
      await openApp();
      userEvent.type(team1(), "benf");
      const benfica = await screen.findByRole("option", { name: /Benfica/ });
      expect(within(benfica).getByText("Liga Portugal")).toBeInTheDocument();
      userEvent.type(team2(), "dinamo");
      const dinamo = await screen.findByRole("option", { name: /Dinamo Zagreb/ });
      expect(within(dinamo).getByText("Autres clubs européens")).toBeInTheDocument();
    });

    test("la liste enregistrée par cette version est réutilisée telle quelle, avec son numéro de version", async () => {
      seedCatalog(3600000);
      const calls = installFetch(withCatalog());
      await openApp();
      userEvent.type(team1(), "benf");
      expect(screen.getByRole("option", { name: /Benfica/ })).toBeInTheDocument();
      expect(calls.catalog).toHaveLength(0);
    });

    test("la liste demandée au serveur est enregistrée avec son numéro de version", async () => {
      installFetch(withCatalog());
      await openApp();
      await waitFor(() => expect(savedCatalog()).not.toBeNull());
      expect(savedCatalog().v).toBe(2);
    });
  });
});

// ---------- Choix du type de pari ----------
describe("choix du type de pari", () => {
  test("le champ montre le pari actuel ; la fenêtre s'ouvre sur sa famille, les autres familles sont repliées", async () => {
    installFetch({});
    await openApp();
    const field = screen.getByRole("button", { name: "Type de pari : Victoire équipe 1" });
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    userEvent.click(field);
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(pickerDialog()).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("radio", { name: "Victoire équipe 1" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Résultat du match" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Total de buts du match" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radio", { name: "Plus de 2.5 buts" })).not.toBeInTheDocument();
  });

  test("les familles se déplient une à une, et choisir un pari ferme la fenêtre", async () => {
    installFetch({});
    await openApp();
    openPicker();
    userEvent.click(screen.getByRole("button", { name: "Total de buts du match" }));
    expect(screen.getByRole("radio", { name: "Plus de 2.5 buts" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Moins de 3 buts" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Victoire équipe 1" })).not.toBeInTheDocument(); // la famille précédente s'est repliée
    expect(screen.getByRole("button", { name: "Résultat du match" })).toHaveAttribute("aria-expanded", "false");
    userEvent.click(screen.getByRole("button", { name: "Total de buts du match" })); // toucher la famille ouverte la referme
    expect(screen.queryByRole("radio", { name: "Plus de 2.5 buts" })).not.toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Total de buts du match" }));
    userEvent.click(screen.getByRole("radio", { name: "Plus de 2.5 buts" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type de pari : Plus de 2.5 buts" })).toHaveFocus(); // le focus revient au champ
  });

  test("la fenêtre s'ouvre sur la famille du pari choisi, et les autres familles restent à portée", async () => {
    installFetch({});
    await openApp();
    pickBet("Équipe 2 moins de 1.5 buts");
    openPicker();
    expect(screen.getByRole("radio", { name: "Équipe 2 moins de 1.5 buts" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Buts de l'équipe 2" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("radio", { name: "Équipe 2 plus de 2.5 buts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Résultat du match" })).toHaveAttribute("aria-expanded", "false");
  });

  test("la recherche parcourt toutes les familles, sans accents ni majuscules, « 2,5 » comme « 2.5 »", async () => {
    installFetch({});
    await openApp();
    openPicker();
    const search = within(pickerDialog()).getByLabelText("Rechercher un pari");
    userEvent.type(search, "EQUIPE 2 plus de 2,5");
    expect(screen.getByRole("radio", { name: "Équipe 2 plus de 2.5 buts" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Victoire équipe 2 et plus de 2.5 buts" })).toBeInTheDocument(); // une autre famille
    expect(screen.queryByRole("radio", { name: "Équipe 2 plus de 1.5 buts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Équipe 1 plus de 2.5 buts" })).not.toBeInTheDocument();
    userEvent.clear(search);
    userEvent.type(search, "pari qui n'existe pas");
    expect(screen.getByText("Aucun pari ne correspond à « pari qui n'existe pas ».")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Effacer la recherche" })); // retour à la liste par familles
    expect(screen.getByRole("radio", { name: "Victoire équipe 1" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Résultat du match" })).toHaveAttribute("aria-expanded", "true");
  });

  test("la fenêtre se ferme par Échap, par « Fermer » ou en touchant le fond, sans changer le pari", async () => {
    installFetch({});
    await openApp();
    const field = () => screen.getByRole("button", { name: "Type de pari : Victoire équipe 1" });
    openPicker();
    fireEvent.keyDown(pickerDialog(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    openPicker();
    userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openPicker();
    // eslint-disable-next-line testing-library/no-node-access
    userEvent.click(pickerDialog().parentElement); // le fond sombre autour de la fenêtre
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(field()).toBeInTheDocument();
  });

  test("la page derrière ne défile pas pendant que la fenêtre est ouverte, et Tab reste dans la fenêtre", async () => {
    installFetch({});
    await openApp();
    openPicker();
    expect(document.body.style.overflow).toBe("hidden");
    const first = screen.getByRole("button", { name: "Fermer" }); // premier élément de la fenêtre
    const last = screen.getByRole("button", { name: "Score" }); // dernier : la dernière famille
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus(); // retour au début au lieu de sortir de la fenêtre
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(document.body.style.overflow).toBe("");
  });

  test("un pari à ligne entière annonce qu'il est remboursé quand le résultat tombe pile sur la ligne", async () => {
    installFetch({});
    await openApp();
    expect(screen.queryByText(/remboursé si/i)).not.toBeInTheDocument(); // « Victoire équipe 1 » n'est jamais remboursé
    pickBet("Plus de 2 buts");
    expect(screen.getByText("Ligne entière : remboursé si le match se termine avec exactement 2 buts au total.")).toBeInTheDocument();
    openPicker();
    expect(screen.getAllByText("Remboursé si le match se termine avec exactement 2 buts au total")).toHaveLength(2); // « plus de » et « moins de » 2 buts
    expect(screen.queryByText(/Remboursé si l'équipe 1/)).not.toBeInTheDocument(); // une autre famille, repliée
  });

  test("le pari choisi est envoyé tel quel au serveur, et reste choisi pour le match suivant", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ typePari: "Victoire ou nul équipe 2 et plus de 1.5 buts" })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Victoire ou nul équipe 2 et plus de 1.5 buts");
    expect(screen.getByRole("button", { name: "Type de pari : Victoire ou nul équipe 2 et plus de 1.5 buts" })).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText("62 %", { selector: ".sel__prob" });
    expect(calls[0].body.legs).toEqual([{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Victoire ou nul équipe 2 et plus de 1.5 buts" }]);
  });
});

// ---------- Paris à ligne entière : remboursement ----------
describe("remboursement des paris à ligne entière", () => {
  test("lecture : le serveur annonce la probabilité et le cas du remboursement", () => {
    expect(toEstimate(okLeg({ typePari: "Plus de 2 buts", remboursement: REFUND })).refund).toEqual(REFUND);
    expect(fromTopMatch(topEntry(0, { remboursement: REFUND })).refund).toEqual(REFUND);
  });

  test("sans remboursement annoncé (ou avec une valeur illisible), rien n'est inventé", () => {
    expect(toEstimate(okLeg()).refund).toBeUndefined();
    expect(fromTopMatch(topEntry(0)).refund).toBeUndefined();
    for (const bad of [null, undefined, 12, "texte", [], {}, { probabilite: "17", quand: "x" }, { probabilite: 17 }, { probabilite: 17, quand: "  " }, { probabilite: NaN, quand: "x" }]) {
      expect(asRefund(bad)).toBeUndefined();
    }
    expect(asRefund({ probabilite: 17.1, quand: " le total est de 2 buts " })).toEqual({ probabilite: 17.1, quand: "le total est de 2 buts" });
  });

  test("la phrase de remboursement : avec ou sans probabilité", () => {
    expect(refundNote(REFUND)).toBe(REFUND_NOTE);
    expect(refundNote({ quand: "l'équipe 1 marque exactement 1 but" })).toBe("Remboursé si l'équipe 1 marque exactement 1 but.");
  });

  test("Mon coupon : la règle est rappelée dès l'ajout, la chance de remboursement s'y ajoute après l'analyse", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ typePari: "Plus de 2 buts", probabilite: 55.4, remboursement: REFUND })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 2 buts");
    expect(screen.getByText("Remboursé si le match se termine avec exactement 2 buts au total.")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    expect(await screen.findByText(REFUND_NOTE)).toBeInTheDocument();
    expect(screen.queryByText("Remboursé si le match se termine avec exactement 2 buts au total.")).not.toBeInTheDocument();
    expect(screen.getAllByText("55 %")).toHaveLength(2); // la probabilité de gagner, remboursement exclu ; le total la reprend
  });

  test("Auto : le remboursement annoncé suit le pari dans le coupon", async () => {
    installFetch({
      "POST /api/auto-coupon": () => ({ body: { resultats: [{ index: 0, ...okLeg({ typePari: "Équipe 1 moins de 2 buts", probabilite: 71.3, remboursement: { probabilite: 24.5, quand: "l'équipe 1 marque exactement 2 buts" } }) }], analyses: 1 } }),
    });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    userEvent.type(screen.getByLabelText("Équipe 1 du match à générer"), "Arsenal");
    userEvent.type(screen.getByLabelText("Équipe 2 du match à générer"), "Chelsea");
    userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText("Coupon (1 match)");
    expect(screen.getByText("Équipe 1 moins de 2 buts")).toBeInTheDocument();
    expect(screen.getByText("Remboursé si l'équipe 1 marque exactement 2 buts (24.5 % de chances).")).toBeInTheDocument();
  });

  test("Top Matchs : le remboursement est annoncé sur le match, et il suit le pari dans le coupon", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ topMatches: [topEntry(0, { meilleurPari: "Plus de 2 buts", remboursement: REFUND }), topEntry(1)] }) }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getAllByText(REFUND_NOTE)).toHaveLength(1); // seul ce match est concerné
    userEvent.click(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    userEvent.click(screen.getByRole("button", { name: "Mon coupon" }));
    expect(screen.getByText(REFUND_NOTE)).toBeInTheDocument();
  });
});

// ---------- Anciens noms de paris ----------
describe("anciens noms de paris", () => {
  test("un ancien nom renvoyé par le serveur s'affiche sous son nom actuel", async () => {
    installFetch({
      "POST /api/auto-coupon": () => ({ body: { resultats: [{ index: 0, ...okLeg({ typePari: "Victoire ou nul domicile", probabilite: 79.2 }) }], analyses: 1 } }),
    });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Auto" }));
    userEvent.type(screen.getByLabelText("Équipe 1 du match à générer"), "Arsenal");
    userEvent.type(screen.getByLabelText("Équipe 2 du match à générer"), "Chelsea");
    userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    userEvent.click(screen.getByRole("button", { name: "Générer mon coupon" }));
    await screen.findByText("Coupon (1 match)");
    expect(screen.getByText("Victoire ou nul équipe 1")).toBeInTheDocument();
    expect(screen.queryByText("Victoire ou nul domicile")).not.toBeInTheDocument();
  });

  test("un match du Top Matchs proposé sous un ancien nom s'affiche sous le nom actuel", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ topMatches: [topEntry(1, { meilleurPari: "Victoire/nul domicile + 1.5 buts plus" })] }) }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Real Madrid vs Getafe");
    expect(screen.getByText("Victoire ou nul équipe 1 et plus de 1.5 buts")).toBeInTheDocument();
    expect(screen.queryByText("Victoire/nul domicile + 1.5 buts plus")).not.toBeInTheDocument();
  });
});

// ---------- Onglet Top Matchs : compléments ----------
describe("onglet Top Matchs : présentation", () => {
  test("aucune limite de cote : la cote combinée est seulement une information, sans objectif", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Cote combinée estimée")).toBeInTheDocument();
    expect(screen.getByText("Probabilité combinée")).toBeInTheDocument();
    expect(screen.getByText("37.6 %")).toBeInTheDocument();
    expect(screen.queryByText(/objectif/i)).not.toBeInTheDocument();
  });

  test("« Détails » montre l'argumentaire et le point de vigilance de chaque match, « Masquer » les cache", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.queryByText("Justification du match 0")).not.toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Détails" }));
    expect(screen.getByText("Justification du match 0")).toBeInTheDocument();
    expect(screen.getByText("À surveiller : Rotation possible")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Masquer" }));
    expect(screen.queryByText("Justification du match 0")).not.toBeInTheDocument();
  });

  test("« Actualiser » relance la recherche", async () => {
    let hits = 0;
    installFetch({ "GET /api/top-matches": () => { hits += 1; return { body: topPayload() }; } });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    userEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    await waitFor(() => expect(hits).toBe(2));
  });

  test("le niveau de confiance est écrit à côté de la jauge, et la barre porte la couleur de la probabilité", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ topMatches: [topEntry(0, { probabilite: 45, niveauConfiance: "faible" }), topEntry(1)] }) }) });
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Top Matchs" }));
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Confiance : faible")).toBeInTheDocument();
    expect(screen.getByText("Confiance : moyenne")).toBeInTheDocument();
    const [weak, solid] = screen.getAllByRole("article");
    expect(within(weak).getByText("45 %")).toBeInTheDocument();
    expect(weak).toHaveClass("tone-loss"); // sous 50 %
    expect(within(solid).getByText("76.1 %")).toBeInTheDocument();
    expect(solid).toHaveClass("tone-win"); // 70 % et plus
  });
});

// ---------- Onglet Mon coupon : compléments ----------
describe("onglet Mon coupon : saisie", () => {
  test("ajouter sans nom d'équipe n'ajoute rien", async () => {
    installFetch({});
    await openApp();
    userEvent.type(screen.getByLabelText("Équipe 1 (à domicile)"), "Arsenal");
    userEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    expect(screen.queryByText(/^Coupon \(/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByText("Votre coupon est vide")).toBeInTheDocument();
  });

  test("retirer une sélection la sort du coupon", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Match nul");
    await addMatch("Inter", "Torino", "Match nul");
    expect(screen.getByText("Coupon (2 matchs)")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Retirer Arsenal vs Chelsea" }));
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeInTheDocument();
    expect(screen.getByText("Coupon (1 match)")).toBeInTheDocument();
  });

  test("le verdict suit la probabilité combinée et la cote équitable en découle", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ probabilite: 80 }), okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Match nul", probabilite: 50 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Match nul");
    userEvent.click(screen.getByRole("button", { name: /Analyser/ }));
    await screen.findByText("40 %"); // 0,80 × 0,50
    expect(screen.getByText("Risqué")).toBeInTheDocument(); // entre 25 % et 50 %
    expect(screen.getByText("2.50")).toBeInTheDocument(); // 1 ÷ 0,40
    expect(screen.getByText(/Sélection la plus fragile : Inter vs Torino \(50 %\)\. Sans elle : 80 %\./)).toBeInTheDocument();
  });

  test("le coupon enregistré est vidé, et le pari choisi dans la fenêtre est celui de l'historique", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Équipe 1 plus de 1.5 buts");
    userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.queryByText(/^Coupon \(/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("coupon-pronostics"))[0]).toMatchObject({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Équipe 1 plus de 1.5 buts", statut: "en_attente" });
  });
});

// ---------- Onglet Historique ----------
describe("onglet Historique", () => {
  const entry = (over = {}) => ({
    id: "p1", couponId: "c1", equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts", cote: null, matchDate: "2026-10-18",
    statut: "en_attente", date: new Date(2026, 9, 18, 12, 0).toISOString(), ...over,
  });
  const seedHistory = (list) => localStorage.setItem("coupon-pronostics", JSON.stringify(list));
  const savedHistory = () => JSON.parse(localStorage.getItem("coupon-pronostics"));
  const openHistory = async () => {
    installFetch({});
    await openApp();
    userEvent.click(screen.getByRole("button", { name: "Historique" }));
  };

  test("sans coupon enregistré : un message explique où les trouver", async () => {
    await openHistory();
    expect(screen.getByText("Aucun coupon")).toBeInTheDocument();
    expect(screen.getByText(/Enregistrez un coupon depuis l'onglet/)).toBeInTheDocument();
  });

  test("un coupon porte sa date et son état ; les paris se marquent gagnés ou perdus", async () => {
    seedHistory([entry({ id: "a1" }), entry({ id: "a2", equipe1: "Inter", equipe2: "Torino", typePari: "Match nul" })]);
    await openHistory();
    expect(screen.getByText("18/10/2026")).toBeInTheDocument();
    expect(screen.getByText("En attente")).toBeInTheDocument();
    expect(screen.getByText("Arsenal vs Chelsea - Plus de 1.5 buts")).toBeInTheDocument();
    userEvent.click(screen.getAllByRole("button", { name: "Marquer comme gagné" })[0]);
    userEvent.click(screen.getByRole("button", { name: "Marquer comme perdu" }));
    expect(await screen.findByText("Perdu")).toBeInTheDocument(); // un seul pari perdu suffit à faire perdre le coupon
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(savedHistory().map((p) => p.statut)).toEqual(["gagne", "perdu"]);
  });

  test("marquer le dernier pari d'un coupon gagné le fait passer à « Gagné » et met à jour la réussite", async () => {
    seedHistory([
      entry({ id: "a1", statut: "gagne" }),
      entry({ id: "a2", equipe1: "Inter", equipe2: "Torino" }),
      entry({ id: "b1", couponId: "c2", equipe1: "Paris SG", equipe2: "Marseille", statut: "perdu", date: new Date(2026, 9, 17, 12, 0).toISOString() }),
    ]);
    await openHistory();
    expect(screen.getByText("En attente")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Marquer comme gagné" })); // un seul pari est encore en attente
    expect(await screen.findByText("Gagné")).toBeInTheDocument();
    expect(screen.queryByText("En attente")).not.toBeInTheDocument();
    expect(screen.getByText(/Réussite/)).toHaveTextContent("Réussite : 67 %"); // 2 gagnés sur 3
    expect(screen.getByText(/Clôturés/)).toHaveTextContent("Clôturés : 3");
    expect(savedHistory().find((p) => p.id === "a2").statut).toBe("gagne");
  });

  test("les coupons sont classés du plus récent au plus ancien", async () => {
    seedHistory([
      entry({ id: "old", couponId: "c-old", equipe1: "Ancien", equipe2: "Match", date: new Date(2026, 9, 10, 12, 0).toISOString() }),
      entry({ id: "new", couponId: "c-new", equipe1: "Nouveau", equipe2: "Match", date: new Date(2026, 9, 17, 12, 0).toISOString() }),
    ]);
    await openHistory();
    const rows = screen.getAllByText(/ - Plus de 1\.5 buts$/).map((el) => el.textContent);
    expect(rows).toEqual(["Nouveau vs Match - Plus de 1.5 buts", "Ancien vs Match - Plus de 1.5 buts"]);
  });

  test("supprimer un pari le retire de l'historique et de l'appareil", async () => {
    seedHistory([entry({ id: "a1" }), entry({ id: "a2", equipe1: "Inter", equipe2: "Torino" })]);
    await openHistory();
    userEvent.click(screen.getAllByRole("button", { name: "Supprimer ce pari" })[0]);
    expect(screen.queryByText("Arsenal vs Chelsea - Plus de 1.5 buts")).not.toBeInTheDocument();
    expect(screen.getByText("Inter vs Torino - Plus de 1.5 buts")).toBeInTheDocument();
    expect(savedHistory().map((p) => p.id)).toEqual(["a2"]);
  });

  test("les paris enregistrés sous un ancien nom s'affichent sous le nom actuel, sans toucher à l'enregistrement", async () => {
    seedHistory([
      entry({ id: "o1", couponId: "c1", typePari: "Total buts 1.5 plus" }),
      entry({ id: "o2", couponId: "c1", typePari: "Victoire/nul extérieur + 2.5 buts plus" }),
      entry({ id: "o3", couponId: "c1", typePari: "Autre" }),
    ]);
    await openHistory();
    expect(screen.getByText("Arsenal vs Chelsea - Plus de 1.5 buts")).toBeInTheDocument();
    expect(screen.getByText("Arsenal vs Chelsea - Victoire ou nul équipe 2 et plus de 2.5 buts")).toBeInTheDocument();
    expect(screen.getByText("Arsenal vs Chelsea - Autre")).toBeInTheDocument();
    expect(savedHistory().map((p) => p.typePari)).toEqual(["Total buts 1.5 plus", "Victoire/nul extérieur + 2.5 buts plus", "Autre"]);
  });

  test("un pari à ligne entière en attente rappelle le remboursement ; une fois joué, plus de rappel", async () => {
    seedHistory([
      entry({ id: "r1", typePari: "Plus de 2 buts" }),
      entry({ id: "r2", equipe1: "Inter", equipe2: "Torino", typePari: "Match nul" }),
      entry({ id: "r3", equipe1: "Paris SG", equipe2: "Marseille", typePari: "Moins de 1 but" }),
    ]);
    await openHistory();
    expect(screen.getByText("Remboursé si le match se termine avec exactement 2 buts au total : dans ce cas, supprimez ce pari.")).toBeInTheDocument();
    expect(screen.getByText("Remboursé si le match se termine avec exactement 1 but au total : dans ce cas, supprimez ce pari.")).toBeInTheDocument();
    expect(screen.getAllByText(/Remboursé si/)).toHaveLength(2); // pas pour « Match nul »
    userEvent.click(screen.getAllByRole("button", { name: "Marquer comme gagné" })[0]);
    expect(screen.getAllByText(/Remboursé si/)).toHaveLength(1);
  });

  test("l'historique d'un ancien nom compte dans l'estimation d'un pari de même nom actuel", async () => {
    seedHistory(Array.from({ length: 5 }, (_, i) => entry({ id: `h${i}`, couponId: `c${i}`, typePari: "Victoire domicile", statut: "gagne" })));
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Victoire équipe 1");
    expect(screen.getByText("Estimation d'après votre historique (5 paris), pas encore analysé")).toBeInTheDocument();
  });
});
