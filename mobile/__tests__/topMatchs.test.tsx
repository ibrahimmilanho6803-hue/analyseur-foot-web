import { fireEvent, screen } from "@testing-library/react-native";
import { button, openApp, openTab, resetStorage } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";
import { CROSS_MESSAGE, cross, topEntry, topPayload } from "../test-support/fixtures";

beforeEach(resetStorage);
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe("onglet Top Matchs", () => {
  test("affiche les 4 matchs, la cote combinée estimée, la cote visée et l'avertissement sur les cotes", async () => {
    const calls = installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Top 4 Matchs à venir")).toBeOnTheScreen();
    expect(screen.getByText("Real Madrid vs Getafe")).toBeOnTheScreen();
    expect(screen.getByText("Inter vs Torino")).toBeOnTheScreen();
    expect(screen.getByText("Napoli vs Genoa")).toBeOnTheScreen();
    expect(screen.getByText("67.4 %")).toBeOnTheScreen();
    expect(screen.getByText("5.01")).toBeOnTheScreen(); // cote combinée
    expect(screen.getByText("19.9 %")).toBeOnTheScreen(); // probabilité combinée
    expect(screen.getByText("Cote visée : 5 ou plus (atteinte)")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })).toHaveLength(4);
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

  test("l'application présente tel quel ce que le serveur choisit, sans rien filtrer", async () => {
    installFetch({
      "GET /api/top-matches": () => ({
        body: topPayload({ topMatches: [topEntry(0, { meilleurPari: "Plus de 0.5 buts", probabilite: 97.2, coteEstimee: 1.03 })], coteTotale: "1.03", probabiliteCombinee: 97.2, objectifCoteAtteint: false }),
      }),
    });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getAllByText("97.2 %")).toHaveLength(2); // le match et la probabilité combinée
    expect(screen.getAllByText("1.03")).toHaveLength(2); // sa cote estimée et la cote combinée
    expect(screen.getByText("Plus de 0.5 buts")).toBeOnTheScreen();
  });

  test("cote visée non atteinte (trop peu de matchs) : le message du serveur et la ligne sous la cote le disent", async () => {
    const message = "Seulement 2 matchs exploitables trouvés dans les 72 prochaines heures. La cote visée (5) n'est pas atteinte avec les matchs disponibles (cote totale : 3.12).";
    installFetch({
      "GET /api/top-matches": () => ({
        body: topPayload({ topMatches: [topEntry(0), topEntry(1)], coteTotale: "3.12", probabiliteCombinee: 32, objectifCoteAtteint: false, message }),
      }),
    });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.getByText("3.12")).toBeOnTheScreen();
    expect(screen.getByText("Cote visée : 5 ou plus (non atteinte)")).toBeOnTheScreen();
  });

  test("une cote visée décimale s'écrit avec la virgule ; un ancien serveur sans objectif n'affiche pas cette ligne", async () => {
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ objectifCote: 2.5 }) }) });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    expect(screen.getByText("Cote visée : 2,5 ou plus (atteinte)")).toBeOnTheScreen();
    delete (globalThis as { fetch?: unknown }).fetch;
    installFetch({ "GET /api/top-matches": () => ({ body: topPayload({ objectifCote: undefined, objectifCoteAtteint: undefined }) }) });
    await fireEvent.press(button("Actualiser"));
    await screen.findByText("Cote combinée estimée"); // le résumé revient quand la nouvelle réponse est arrivée
    expect(screen.queryByText(/Cote visée/)).not.toBeOnTheScreen();
  });

  test("un pari à ligne entière : le remboursement est annoncé, et il suit le pari dans le coupon", async () => {
    const refund = { probabilite: 17.1, quand: "le match se termine avec exactement 2 buts au total" };
    installFetch({
      "GET /api/top-matches": () => ({ body: topPayload({ topMatches: [topEntry(0, { meilleurPari: "Plus de 2 buts", remboursement: refund }), topEntry(1)] }) }),
    });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    const note = "Remboursé si le match se termine avec exactement 2 buts au total (17.1 % de chances).";
    expect(screen.getAllByText(note)).toHaveLength(1); // seul ce match est concerné
    await fireEvent.press(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    await openTab("Mon coupon");
    expect(screen.getByText(note)).toBeOnTheScreen();
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
    expect(screen.getAllByText("67 %").length).toBeGreaterThan(0);
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

