import { fireEvent, screen } from "@testing-library/react-native";
import { button, openApp, openTab, resetStorage } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";
import { CROSS_MESSAGE, cross, topEntry, topPayload } from "../test-support/fixtures";

beforeEach(resetStorage);
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe("onglet Top Matchs", () => {
  test("affiche les 3 matchs, la cote combinée estimée et l'avertissement sur les cotes", async () => {
    const calls = installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Real Madrid vs Getafe")).toBeOnTheScreen();
    expect(screen.getByText("Inter vs Torino")).toBeOnTheScreen();
    expect(screen.getByText("78.4 %")).toBeOnTheScreen();
    expect(screen.getByText("2.66")).toBeOnTheScreen();
    expect(screen.getByText(/Cotes estimées \(1 ÷ probabilité\)/)).toBeOnTheScreen(); // avertissement envoyé par le serveur
    expect(screen.getByText(/Analyse de 8 championnats/)).toBeOnTheScreen();
    expect(calls.filter((c) => c.path === "/api/top-matches")).toHaveLength(1);
  });

  test("ne recharge pas à chaque passage sur l'onglet", async () => {
    const calls = installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    await openTab("Mon coupon");
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(calls).toHaveLength(1);
  });

  test("IA indisponible : l'application le dit clairement", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ ia: { statut: "indisponible", modele: "claude-sonnet-5-5" } }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText(/modèle statistique seul/);
  });

  test("IA désactivée sur le serveur : même information, formulée comme telle", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ ia: { statut: "desactivee" } }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText(/relecture par l'IA est désactivée sur le serveur/);
  });

  test("sélection conservée ou championnats encore en chargement : l'application prévient", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ perime: true, complet: false }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText(/Sélection précédente conservée/);
    expect(screen.getByText(/Certains championnats sont encore en cours de chargement/)).toBeOnTheScreen();
  });

  test("objectif de cote non atteint : le dit sans l'enjoliver", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ objectifCoteAtteint: false, topMatches: [topEntry(0)], coteTotale: "1.28", probabiliteCombinee: 78.4 }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText(/Objectif de cote \(2.5\) non atteint/);
  });

  test("erreur du serveur : message clair et possibilité de réessayer", async () => {
    installFetch({ "GET /api/top-matches": () => ({ status: 503, body: { error: "Aucune source de données n'est disponible pour le moment." } }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText(/Aucune source de données n'est disponible pour le moment\./);
    expect(button("Actualiser")).toBeOnTheScreen();
  });

  test("« Actualiser » relance la recherche", async () => {
    let hits = 0;
    installFetch({
      "GET /api/top-matches": () => {
        hits += 1;
        return { body: topPayload() };
      },
    });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    await fireEvent.press(button("Actualiser"));
    await screen.findByText("Arsenal vs Chelsea");
    expect(hits).toBe(2);
  });

  test("« Détails » montre l'argumentaire et le point de vigilance de chaque match", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.queryByText("Justification du match 0")).not.toBeOnTheScreen();
    await fireEvent.press(button("Détails"));
    expect(screen.getByText("Justification du match 0")).toBeOnTheScreen();
    expect(screen.getByText("À surveiller : Rotation possible")).toBeOnTheScreen();
    await fireEvent.press(button("Masquer"));
    expect(screen.queryByText("Justification du match 0")).not.toBeOnTheScreen();
  });

  test("ajouter un match au coupon, une seule fois, avec sa probabilité déjà connue", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    await fireEvent.press(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    expect(button("Déjà dans le coupon")).toBeDisabled();
    await openTab("Mon coupon");
    expect(screen.getAllByText("78 %").length).toBeGreaterThan(0);
    expect(screen.queryByText("Estimation indicative")).not.toBeOnTheScreen(); // l'analyse du serveur est déjà là
    expect(screen.queryByText(/pas d'analyse chiffrée/)).not.toBeOnTheScreen();
  });

  test("un match du Top Matchs ajouté au coupon montre son championnat", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    await fireEvent.press(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    await openTab("Mon coupon");
    expect(screen.getByText(/^Premier League · /)).toBeOnTheScreen();
  });
});

describe("onglet Top Matchs : coupes d'Europe", () => {
  const leagues = ["PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "BSA"];

  test("le sous-titre compte aussi les coupes d'Europe analysées", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: ["CL", "EL", "UECL"] } }) }) });
    await openApp();
    await openTab("Top Matchs");
    expect(await screen.findByText(/Analyse de 8 championnats et 3 coupes d'Europe, matchs des 72 prochaines heures/)).toBeOnTheScreen();
  });

  test("une seule coupe : singulier ; aucune coupe (serveur plus ancien) : la phrase d'avant", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: ["CL"] } }) }) });
    await openApp();
    await openTab("Top Matchs");
    expect(await screen.findByText(/Analyse de 8 championnats et 1 coupe d'Europe, matchs/)).toBeOnTheScreen();
  });

  test("sans coupe annoncée, le sous-titre ne parle pas de coupes", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ donnees: { championnatsPrets: leagues, coupesPretes: [] } }) }) });
    await openApp();
    await openTab("Top Matchs");
    expect(await screen.findByText(/Analyse de 8 championnats, matchs des 72 prochaines heures/)).toBeOnTheScreen();
    expect(screen.queryByText(/coupe/)).not.toBeOnTheScreen();
  });

  test("un match de coupe entre deux championnats porte l'avertissement du serveur, et le garde dans le coupon", async () => {
    const entries = [topEntry(0, { competition: "UEFA Champions League", comparaisonEntreChampionnats: cross() }), topEntry(1), topEntry(2)];
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ topMatches: entries }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("UEFA Champions League")).toBeOnTheScreen();
    expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1); // seul ce match est concerné
    await fireEvent.press(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    await openTab("Mon coupon");
    expect(screen.getByText(CROSS_MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText(/^1 sélection oppose des clubs de championnats différents/)).toBeOnTheScreen();
  });
});

