import { fireEvent, screen } from "@testing-library/react-native";
import { button, openApp, openTab, resetStorage, typeAutoMatch } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";
import { CROSS_MESSAGE, cupLeg, okLeg } from "../test-support/fixtures";

beforeEach(resetStorage);
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe("onglet Auto", () => {
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
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await typeAutoMatch("Inter", "Torino");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Coupon (2 matchs)");
    expect(screen.getByText("Victoire ou nul domicile")).toBeOnTheScreen();
    expect(screen.getByText("79 %")).toBeOnTheScreen();
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/api/auto-coupon");
    expect(calls[0].body).toEqual({ matches: [{ equipe1: "Arsenal", equipe2: "Chelsea" }, { equipe1: "Inter", equipe2: "Torino" }] });
    expect(calls.some((c) => /analyze-simple|anthropic/i.test(c.url))).toBe(false);
  });

  test("le bouton reste inactif tant qu'aucun match n'est saisi", async () => {
    const calls = installFetch({});
    await openApp();
    await openTab("Auto");
    expect(button("Générer mon coupon")).toBeDisabled();
    await fireEvent.press(button("Générer mon coupon"));
    expect(calls).toHaveLength(0);
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
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await typeAutoMatch("Xyz", "Abc");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText(/1 pronostic ajouté à « Mon coupon »/);
    expect(screen.getByText(/Xyz vs Abc : Équipe introuvable/)).toBeOnTheScreen();
    expect(screen.getByText("Xyz vs Abc")).toBeOnTheScreen(); // reste dans la liste pour être corrigé
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeOnTheScreen(); // celui-ci est passé dans le coupon
    await fireEvent.press(button("Voir mon coupon"));
    expect(await screen.findByText("Coupon (1 match)")).toBeOnTheScreen();
  });

  test("serveur en erreur : message affiché, la liste des matchs est conservée", async () => {
    installFetch({ "POST /api/auto-coupon": () => ({ status: 429, body: { error: "Trop de demandes : réessayez dans 30 s." } }) });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Trop de demandes : réessayez dans 30 s.");
    expect(screen.getByText("Arsenal vs Chelsea")).toBeOnTheScreen();
  });

  test("retirer un match de la liste", async () => {
    installFetch({});
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await typeAutoMatch("Inter", "Torino");
    await fireEvent.press(button("Retirer Arsenal vs Chelsea"));
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeOnTheScreen();
    expect(screen.getByText("Inter vs Torino")).toBeOnTheScreen();
  });

  test("douze matchs au maximum", async () => {
    installFetch({});
    await openApp();
    await openTab("Auto");
    for (let i = 0; i < 12; i += 1) await typeAutoMatch(`Domicile${i}`, `Visiteur${i}`);
    await typeAutoMatch("Trop", "Loin");
    await screen.findByText(/12 matchs au maximum/);
    expect(screen.queryByText("Trop vs Loin")).not.toBeOnTheScreen();
  });

  test("pendant la génération : bouton inactif et message d'attente", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    installFetch({ "POST /api/auto-coupon": () => gate.then(() => ({ body: { resultats: [{ index: 0, ...okLeg() }] } })) });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await fireEvent.press(button("Générer mon coupon"));
    expect(await screen.findByText(/Analyse en cours : jusqu'à une minute\./)).toBeOnTheScreen();
    expect(button("Génération…")).toBeDisabled();
    release();
    await screen.findByText("Coupon (1 match)");
  });
});

describe("onglet Auto : n'importe quel match", () => {
  test("un match de Ligue des champions est analysé, ajouté au coupon avec son avertissement", async () => {
    const calls = installFetch({
      "POST /api/auto-coupon": () => ({
        body: { resultats: [{ index: 0, ...cupLeg({ typePari: "Victoire ou nul domicile", probabilite: 66.4 }) }], analyses: 1 },
      }),
    });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Real Madrid");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Coupon (1 match)");
    expect(calls[0].body).toEqual({ matches: [{ equipe1: "Arsenal", equipe2: "Real Madrid" }] });
    expect(screen.getAllByText("66 %").length).toBeGreaterThan(0);
    expect(screen.getByText(/^UEFA Champions League · /)).toBeOnTheScreen();
    expect(screen.getByText(CROSS_MESSAGE)).toBeOnTheScreen();
  });

  test("un match entre deux clubs du même championnat n'a pas cet avertissement", async () => {
    installFetch({ "POST /api/auto-coupon": () => ({ body: { resultats: [{ index: 0, ...okLeg() }] } }) });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Coupon (1 match)");
    expect(screen.queryByText(/ne jouent pas dans le même championnat/)).not.toBeOnTheScreen();
  });

  test("l'écran le dit : les deux clubs peuvent venir de championnats différents", async () => {
    installFetch({});
    await openApp();
    await openTab("Auto");
    expect(screen.getByText(/Les deux clubs peuvent venir de championnats différents \(Ligue des champions, par exemple\)/)).toBeOnTheScreen();
  });
});


describe("onglet Auto : plus de limite de cote", () => {
  test("le texte d'aide parle du pari le plus fiable, quelle que soit sa cote, et plus d'une plage de probabilité", async () => {
    installFetch({});
    await openApp();
    await openTab("Auto");
    expect(screen.getByText(/le pari le plus fiable, c'est-à-dire le plus probable, quelle que soit sa cote/)).toBeOnTheScreen();
    expect(screen.queryByText(/55 %/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/88 %/)).not.toBeOnTheScreen();
  });

  test("un pari très sûr (97 %) est accepté tel quel dans le coupon", async () => {
    installFetch({
      "POST /api/auto-coupon": () => ({
        body: { resultats: [{ index: 0, ...okLeg({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 0.5 buts", probabilite: 97.2, coteEstimee: 1.03 }) }], analyses: 1, probabiliteCombinee: 97.2, coteTotale: "1.03" },
      }),
    });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Coupon (1 match)");
    expect(screen.getByText("Plus de 0.5 buts")).toBeOnTheScreen();
    expect(screen.getAllByText("97 %")).toHaveLength(2); // la sélection et le total du coupon
    expect(screen.getByText(/Cote équitable estimée : 1\.03/)).toBeOnTheScreen();
  });
});
