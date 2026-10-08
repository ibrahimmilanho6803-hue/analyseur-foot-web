import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { callApi, estimateProb, estimatesForChunk, fromTopMatch, toEstimate } from "./AnalyseurCoupon";

// ---------- Faux serveur : chaque appel est enregistré, aucun appel réseau réel ----------
function installFetch(routes) {
  const calls = [];
  global.fetch = jest.fn((url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    calls.push({ url: String(url), path, method, body: opts.body ? JSON.parse(opts.body) : undefined });
    const handler = routes[`${method} ${path}`];
    if (!handler) return Promise.reject(new Error(`appel inattendu : ${method} ${path}`));
    const out = handler(opts.body ? JSON.parse(opts.body) : undefined);
    if (out instanceof Error) return Promise.reject(out);
    const status = out.status || 200;
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(out.body) });
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
  meilleurPari: ["Plus de 1.5 buts", "Victoire ou nul domicile", "Plus de 0.5 buts"][i],
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

async function openApp() {
  render(<App />);
  await screen.findByText("Analyseur Foot Pro");
}

async function addMatch(home, away, bet) {
  userEvent.type(screen.getByLabelText("Équipe 1 (à domicile)"), home);
  userEvent.type(screen.getByLabelText("Équipe 2 (à l'extérieur)"), away);
  if (bet) userEvent.selectOptions(screen.getByLabelText("Type de pari"), bet);
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
            { index: 0, ...okLeg({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Victoire ou nul domicile", probabilite: 79.2 }) },
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
    expect(screen.getAllByText("Victoire ou nul domicile").length).toBeGreaterThanOrEqual(2); // la liste déroulante et la carte du match
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
            { index: 0, ...okLeg({ typePari: "Victoire ou nul domicile", probabilite: 79.2 }) },
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
