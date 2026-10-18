import { fireEvent, screen } from "@testing-library/react-native";
import { addMatch, button, openApp, openTab, resetStorage, typeAutoMatch } from "../test-support/app";
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
            { index: 0, ...okLeg({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Victoire ou nul équipe 1", probabilite: 67.2 }) },
            { index: 1, ...okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Plus de 1.5 buts", probabilite: 66.8 }) },
            { index: 2, ...okLeg({ equipe1: "Real Madrid", equipe2: "Getafe", typePari: "Moins de 3.5 buts", probabilite: 66.5 }) },
            { index: 3, ...okLeg({ equipe1: "Napoli", equipe2: "Genoa", typePari: "Équipe 1 plus de 1.5 buts", probabilite: 66.6 }) },
          ],
          analyses: 4,
          probabiliteCombinee: 19.9,
          coteTotale: "5.03",
          objectifCote: 5,
          objectifCoteAtteint: true,
          avertissement: "Cotes estimées",
        },
      }),
    });
    await openApp();
    await openTab("Auto");
    await typeAutoMatch("Arsenal", "Chelsea");
    await typeAutoMatch("Inter", "Torino");
    await typeAutoMatch("Real Madrid", "Getafe");
    await typeAutoMatch("Napoli", "Genoa");
    await fireEvent.press(button("Générer mon coupon"));
    await screen.findByText("Coupon (4 matchs)");
    expect(screen.getByText("Victoire ou nul équipe 1")).toBeOnTheScreen();
    expect(screen.getByText("Moins de 3.5 buts")).toBeOnTheScreen();
    expect(screen.getAllByText("67 %").length).toBeGreaterThan(0); // 67.2, 66.8, 66.5 et 66.6 s'affichent tous « 67 % »
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/api/auto-coupon");
    expect(calls[0].body).toEqual({
      matches: [
        { equipe1: "Arsenal", equipe2: "Chelsea" },
        { equipe1: "Inter", equipe2: "Torino" },
        { equipe1: "Real Madrid", equipe2: "Getafe" },
        { equipe1: "Napoli", equipe2: "Genoa" },
      ],
    });
    expect(calls.some((c) => /analyze-simple|anthropic/i.test(c.url))).toBe(false);
    await openTab("Auto");
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeOnTheScreen(); // la cote visée est atteinte : les matchs sont passés dans le coupon
  });

  test("l'écran le dit : au moins 3 matchs, pour une cote totale de 5 avec des paris aussi fiables que possible", async () => {
    installFetch({});
    await openApp();
    await openTab("Auto");
    expect(screen.getByText(/Saisissez au moins 3 matchs : le serveur choisit pour chacun un pari de façon que la cote totale du coupon atteigne 5, avec des paris aussi fiables que possible/)).toBeOnTheScreen();
    expect(screen.queryByText(/quelle que soit sa cote/)).not.toBeOnTheScreen();
  });

  describe("cote visée non atteinte", () => {
    const message = "La cote visée (5) n'est pas atteinte (cote totale : 3.38). Avec 2 matchs, des paris fiables ne permettent pas d'aller plus haut : ajoutez des matchs.";
    const answer = (body: { matches: { equipe1: string; equipe2: string }[] }, over: Record<string, unknown> = {}) => ({
      resultats: body.matches.map((m, i) => ({ index: i, ...okLeg({ equipe1: m.equipe1, equipe2: m.equipe2, typePari: "Moins de 3.5 buts", probabilite: 58.2 + i }) })),
      analyses: body.matches.length,
      objectifCote: 5,
      ...over,
    });

    test("deux matchs seulement : pronostics ajoutés, message du serveur affiché, matchs conservés, on reste sur Auto", async () => {
      installFetch({ "POST /api/auto-coupon": (body) => ({ body: answer(body, { coteTotale: "3.38", objectifCoteAtteint: false, message }) }) });
      await openApp();
      await openTab("Auto");
      await typeAutoMatch("Arsenal", "Chelsea");
      await typeAutoMatch("Inter", "Torino");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText(/2 pronostics ajoutés à « Mon coupon »/);
      expect(screen.getByText(/La cote visée \(5\) n'est pas atteinte \(cote totale : 3\.38\)\. Avec 2 matchs/)).toBeOnTheScreen();
      expect(screen.getByText(/Les matchs restent dans la liste : une nouvelle génération remplacera les pronostics que celle-ci vient d'ajouter à votre coupon\./)).toBeOnTheScreen();
      expect(screen.getByText("Arsenal vs Chelsea")).toBeOnTheScreen();
      expect(screen.getByText("Inter vs Torino")).toBeOnTheScreen();
      await fireEvent.press(button("Voir mon coupon"));
      expect(await screen.findByText("Coupon (2 matchs)")).toBeOnTheScreen();
    });

    test("une nouvelle génération avec plus de matchs remplace les pronostics de la précédente au lieu de les doubler", async () => {
      let hits = 0;
      const calls = installFetch({
        "POST /api/auto-coupon": (body) => {
          hits += 1;
          return { body: hits === 1 ? answer(body, { coteTotale: "3.38", objectifCoteAtteint: false, message }) : answer(body, { coteTotale: "5.03", objectifCoteAtteint: true }) };
        },
      });
      await openApp();
      await openTab("Auto");
      await typeAutoMatch("Arsenal", "Chelsea");
      await typeAutoMatch("Inter", "Torino");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText(/2 pronostics ajoutés à « Mon coupon »/);
      await typeAutoMatch("Real Madrid", "Getafe");
      await typeAutoMatch("Napoli", "Genoa");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText("Coupon (4 matchs)"); // et non 6 : les deux premiers pronostics ont été remplacés
      expect(calls[1].body.matches).toHaveLength(4);
      await openTab("Auto");
      expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeOnTheScreen(); // la cote est atteinte cette fois : la liste est vidée
    });

    test("les pronostics ajoutés à la main ne sont jamais remplacés", async () => {
      let hits = 0;
      installFetch({
        "POST /api/auto-coupon": (body) => {
          hits += 1;
          return { body: hits === 1 ? answer(body, { coteTotale: "3.38", objectifCoteAtteint: false, message }) : answer(body, { coteTotale: "5.03", objectifCoteAtteint: true }) };
        },
      });
      await openApp();
      await addMatch("PSG", "OM", "Match nul");
      await openTab("Auto");
      await typeAutoMatch("Arsenal", "Chelsea");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText(/1 pronostic ajouté à « Mon coupon »/);
      await typeAutoMatch("Inter", "Torino");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText("Coupon (3 matchs)"); // le pari saisi à la main + les deux paris de la seconde génération
      expect(screen.getByText("PSG vs OM")).toBeOnTheScreen();
    });

    test("la cote est atteinte de justesse mais l'IA l'a fait passer sous l'objectif : même message, même comportement", async () => {
      installFetch({
        "POST /api/auto-coupon": (body) => ({
          body: answer(body, { coteTotale: "4.99", objectifCoteAtteint: false, message: "La cote visée (5) n'est pas atteinte (cote totale : 4.99). La relecture de l'IA a légèrement modifié les probabilités." }),
        }),
      });
      await openApp();
      await openTab("Auto");
      for (const [home, away] of [["Arsenal", "Chelsea"], ["Inter", "Torino"], ["Real Madrid", "Getafe"], ["Napoli", "Genoa"]]) await typeAutoMatch(home, away);
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText(/cote totale : 4\.99\)\. La relecture de l'IA a légèrement modifié les probabilités\./);
      expect(screen.getByText(/4 pronostics ajoutés à « Mon coupon »/)).toBeOnTheScreen();
    });

    test("un serveur qui ne parle pas de cote visée (ancienne version) : comportement d'avant, on ouvre « Mon coupon »", async () => {
      installFetch({ "POST /api/auto-coupon": (body) => ({ body: answer(body, { objectifCote: undefined }) }) });
      await openApp();
      await openTab("Auto");
      await typeAutoMatch("Arsenal", "Chelsea");
      await fireEvent.press(button("Générer mon coupon"));
      await screen.findByText("Coupon (1 match)");
    });
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
            { index: 0, ...okLeg({ typePari: "Victoire ou nul équipe 1", probabilite: 79.2 }) },
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
        body: { resultats: [{ index: 0, ...cupLeg({ typePari: "Victoire ou nul équipe 1", probabilite: 66.4 }) }], analyses: 1 },
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

