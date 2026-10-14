import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { addMatch, button, openApp, openTab, resetStorage, savedCatalog, seedCatalog, suggestionList, suggestionOptions, team1, team2, withCatalog } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";
import { CATALOG } from "../test-support/fixtures";

beforeEach(resetStorage);
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

// `skipBlur` : en vrai, le champ garde le focus tant qu'on ne touche pas un autre champ (la liste reste alors ouverte).
const typeIn = (field: ReturnType<typeof team1>, text: string) => userEvent.setup().type(field, text, { skipBlur: true });

describe("liste des clubs", () => {
  test("demandée au démarrage au serveur, puis gardée sur le téléphone", async () => {
    const calls = installFetch(withCatalog());
    await openApp();
    await waitFor(async () => expect(await savedCatalog()).not.toBeNull());
    expect(calls.catalog).toHaveLength(1);
    expect(calls.catalog[0].url).toBe("https://analyseur-foot-api.onrender.com/api/teams");
    expect((await savedCatalog()).data.equipes).toHaveLength(CATALOG.equipes.length);
  });

  test("liste complète récente : pas de nouvelle demande, et les suggestions marchent tout de suite", async () => {
    await seedCatalog(3600000);
    const calls = installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "psg");
    expect(screen.getByRole("option", { name: /Paris SG/ })).toBeOnTheScreen(); // sans attendre le réseau
    await fireEvent(team2(), "focus");
    expect(calls.catalog).toHaveLength(0);
  });

  test("liste complète de plus de 24 h : redemandée, l'ancienne sert en attendant", async () => {
    await seedCatalog(25 * 3600000);
    const calls = installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "psg");
    expect(screen.getByRole("option", { name: /Paris SG/ })).toBeOnTheScreen();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
  });

  test("liste incomplète (championnats en chargement) : redemandée dès qu'elle a plus d'une minute", async () => {
    await seedCatalog(2 * 60000, { complet: false, equipes: CATALOG.equipes.slice(0, 3) });
    const calls = installFetch(withCatalog());
    await openApp();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
    await waitFor(async () => expect((await savedCatalog()).data.complet).toBe(true));
    await typeIn(team1(), "psg");
    expect(await screen.findByRole("option", { name: /Paris SG/ })).toBeOnTheScreen();
  });

  test("liste incomplète de moins d'une minute : on ne harcèle pas le serveur", async () => {
    await seedCatalog(10000, { complet: false, equipes: CATALOG.equipes.slice(0, 3) });
    const calls = installFetch(withCatalog());
    await openApp();
    await fireEvent(team1(), "focus");
    await fireEvent(team2(), "focus");
    expect(calls.catalog).toHaveLength(0);
  });

  test("serveur injoignable : champs texte ordinaires, aucune erreur affichée, un seul essai par minute", async () => {
    const calls = installFetch({ "GET /api/teams": () => new TypeError("Failed to fetch") });
    await openApp();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
    await typeIn(team1(), "psg");
    await fireEvent(team2(), "focus");
    await fireEvent(team1(), "focus");
    expect(calls.catalog).toHaveLength(1);
    expect(suggestionList()).not.toBeOnTheScreen();
    expect(team1()).toHaveDisplayValue("psg");
    expect(screen.queryByText(/Impossible de joindre/)).not.toBeOnTheScreen();
    await fireEvent.changeText(team1(), "");
    await addMatch("psg", "om", "Match nul"); // le coupon se construit comme avant
  });

  test("liste abîmée sur le téléphone : ignorée", async () => {
    await AsyncStorage.setItem("coupon-clubs", "{pas du json");
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "psg");
    expect(await screen.findByRole("option", { name: /Paris SG/ })).toBeOnTheScreen();
  });
});

describe("saisie d'un club avec suggestions", () => {
  test("un surnom propose le club ; un appui le choisit", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "psg");
    const option = await screen.findByRole("option", { name: /Paris SG/ });
    expect(within(option).getByText("PSG · Ligue 1")).toBeOnTheScreen();
    expect(team1()).toHaveProp("aria-expanded", true);
    expect(suggestionList()).toBeOnTheScreen();
    await userEvent.setup().press(option);
    expect(team1()).toHaveDisplayValue("Paris SG");
    expect(suggestionList()).not.toBeOnTheScreen();
    expect(team1()).toHaveProp("aria-expanded", false);
  });

  test("les deux champs sont indépendants et le coupon reçoit les noms choisis", async () => {
    installFetch(withCatalog());
    await openApp();
    const user = userEvent.setup();
    await typeIn(team1(), "psg");
    await user.press(await screen.findByRole("option", { name: /Paris SG/ }));
    await typeIn(team2(), "om");
    await user.press(await screen.findByRole("option", { name: /Marseille/ }));
    expect(team1()).toHaveDisplayValue("Paris SG");
    expect(team2()).toHaveDisplayValue("Marseille");
    await fireEvent.press(button(/^Ajouter$/));
    expect(await screen.findByText("Paris SG vs Marseille")).toBeOnTheScreen();
  });

  test("la liste se resserre à mesure que l'on tape, et propose tous les clubs concernés", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "man");
    await screen.findByLabelText("Suggestions de clubs");
    expect(screen.getByRole("option", { name: /Manchester City/ })).toBeOnTheScreen();
    expect(screen.getByRole("option", { name: /Manchester United/ })).toBeOnTheScreen();
    await fireEvent.changeText(team1(), "manchester u");
    expect(screen.queryByRole("option", { name: /Manchester City/ })).not.toBeOnTheScreen();
    expect(screen.getByRole("option", { name: /Manchester United/ })).toBeOnTheScreen();
  });

  test("un nom commun à plusieurs clubs les propose tous (jamais un seul au hasard)", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "paris");
    await screen.findByLabelText("Suggestions de clubs");
    expect(suggestionOptions().length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("option", { name: /^Paris SG/ })).toBeOnTheScreen();
    expect(screen.getByRole("option", { name: /^Paris FC/ })).toBeOnTheScreen();
  });

  test("aucun club ne correspond : message d'aide, la saisie libre reste possible", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "Zzzzzz");
    expect(await screen.findByText(/Aucun club suivi ne correspond/)).toBeOnTheScreen();
    expect(team1()).toHaveDisplayValue("Zzzzzz");
    await fireEvent.changeText(team1(), "");
    await addMatch("Zzzzzz", "Yyyyyy", "Match nul");
  });

  test("liste incomplète : le message d'aide dit que des championnats chargent encore", async () => {
    installFetch(withCatalog({ complet: false }));
    await openApp();
    await typeIn(team1(), "Zzzzzz");
    expect(await screen.findByText(/certains championnats sont encore en chargement/)).toBeOnTheScreen();
  });

  test("quitter le champ ferme la liste ; y revenir la rouvre", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "psg");
    await screen.findByLabelText("Suggestions de clubs");
    await fireEvent(team1(), "blur");
    expect(suggestionList()).not.toBeOnTheScreen();
    await fireEvent(team1(), "focus");
    expect(await screen.findByLabelText("Suggestions de clubs")).toBeOnTheScreen();
  });

  test("onglet Auto : les mêmes suggestions", async () => {
    installFetch(withCatalog());
    await openApp();
    await openTab("Auto");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Équipe 1 du match à générer"), "bay", { skipBlur: true });
    await user.press(await screen.findByRole("option", { name: /Bayern Munich/ }));
    await user.type(screen.getByLabelText("Équipe 2 du match à générer"), "bvb", { skipBlur: true });
    await user.press(await screen.findByRole("option", { name: /Borussia Dortmund/ }));
    await fireEvent.press(button(/^Ajouter$/));
    expect(await screen.findByText("Bayern Munich vs Borussia Dortmund")).toBeOnTheScreen();
  });
});

describe("liste des clubs : tous les championnats suivis", () => {
  test("liste enregistrée par une ancienne version de l'application : ignorée, la liste actuelle est demandée", async () => {
    // Ancien format (sans numéro de version) : seulement quelques clubs des championnats principaux, enregistrée il y a une heure.
    await AsyncStorage.setItem("coupon-clubs", JSON.stringify({ at: Date.now() - 3600000, data: { ...CATALOG, equipes: CATALOG.equipes.slice(0, 3) } }));
    const calls = installFetch(withCatalog());
    await openApp();
    await waitFor(() => expect(calls.catalog).toHaveLength(1));
    await typeIn(team1(), "benf");
    expect(await screen.findByRole("option", { name: /Benfica/ })).toBeOnTheScreen();
  });

  test("un club d'un autre championnat est proposé avec son championnat", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "benf");
    const option = await screen.findByRole("option", { name: /Benfica/ });
    expect(within(option).getByText("Liga Portugal")).toBeOnTheScreen();
  });

  test("un club connu seulement par les coupes d'Europe est proposé, sous « Autres clubs européens »", async () => {
    installFetch(withCatalog());
    await openApp();
    await typeIn(team2(), "dinamo");
    const option = await screen.findByRole("option", { name: /Dinamo Zagreb/ });
    expect(within(option).getByText("Autres clubs européens")).toBeOnTheScreen();
    await userEvent.setup().press(option);
    expect(team2()).toHaveDisplayValue("Dinamo Zagreb");
  });

  test("la liste enregistrée par cette version est réutilisée telle quelle", async () => {
    await seedCatalog(3600000);
    const calls = installFetch(withCatalog());
    await openApp();
    await typeIn(team1(), "benf");
    expect(screen.getByRole("option", { name: /Benfica/ })).toBeOnTheScreen();
    expect(calls.catalog).toHaveLength(0);
    expect((await AsyncStorage.getItem("coupon-clubs"))?.includes('"v":2')).toBe(true);
  });
});

