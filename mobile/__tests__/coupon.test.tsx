import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { addMatch, button, chooseBet, openApp, openTab, readStored, resetStorage, team1, team2 } from "../test-support/app";
import type { Calls } from "../test-support/fakeServer";
import { installFetch } from "../test-support/fakeServer";
import { CROSS_MESSAGE, CROSS_WEAK_MESSAGE, cross, cupLeg, okLeg, parisLeg, quick, reviewed, topPayload } from "../test-support/fixtures";

beforeEach(resetStorage);
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

const analyseurCalls = (calls: Calls) => calls.filter((c) => c.path === "/api/analyze");

describe("onglet Mon coupon", () => {
  test("avant l'analyse, le pourcentage est présenté comme indicatif", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    expect(screen.getByText("Estimation indicative")).toBeOnTheScreen();
    expect(screen.getByText(/n'a pas d'analyse chiffrée/)).toBeOnTheScreen();
    expect(screen.getByText(/Moyenne générale de ce pari/)).toBeOnTheScreen();
  });

  test("le type de pari se choisit dans une feuille, par famille, et la feuille se referme", async () => {
    installFetch({});
    await openApp();
    expect(screen.queryByRole("radio", { name: "Match nul" })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /^Type de pari/ }));
    expect(await screen.findByText("Résultat du match")).toBeOnTheScreen();
    expect(screen.getByText("Total de buts du match")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Victoire domicile" })).toBeChecked(); // le choix actuel est coché
    await fireEvent.press(screen.getByRole("radio", { name: "Match nul" }));
    expect(screen.queryByRole("radio", { name: "Match nul" })).not.toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Type de pari : Match nul" })).toBeOnTheScreen();
  });

  test("ajouter sans nom d'équipe n'ajoute rien", async () => {
    installFetch({});
    await openApp();
    await fireEvent.changeText(team1(), "Arsenal");
    await fireEvent.press(button(/^Ajouter$/));
    expect(screen.queryByText(/^Coupon \(/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeOnTheScreen();
  });

  test("retirer une sélection la sort du coupon", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Match nul");
    await addMatch("Inter", "Torino", "Match nul");
    expect(screen.getByText("Coupon (2 matchs)")).toBeOnTheScreen();
    await fireEvent.press(button("Retirer Arsenal vs Chelsea"));
    expect(screen.queryByText("Arsenal vs Chelsea")).not.toBeOnTheScreen();
    expect(screen.getByText("Coupon (1 match)")).toBeOnTheScreen();
  });

  test("analyse : une seule requête groupée vers /api/analyze, jamais vers l'ancienne route", async () => {
    const calls = installFetch({
      "POST /api/analyze": () => ({ body: { legs: [okLeg(), okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Match nul", probabilite: 21.4 })] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Match nul");
    await fireEvent.press(button("Analyser"));
    await screen.findByText("62 %");
    expect(screen.getByText("21 %")).toBeOnTheScreen();
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
    expect(screen.getByText(/Cote équitable estimée/)).toBeOnTheScreen();
    expect(screen.queryByText("Estimation indicative")).not.toBeOnTheScreen();
    expect(calls.some((c) => /analyze-simple/.test(c.url))).toBe(false);
  });

  test("le verdict suit la probabilité combinée et la cote équitable en découle", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ probabilite: 80 }), okLeg({ equipe1: "Inter", equipe2: "Torino", probabilite: 50 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText("Risqué"); // 0,8 × 0,5 = 40 %
    expect(screen.getByText("40 %")).toBeOnTheScreen();
    expect(screen.getByText(/Cote équitable estimée : 2\.50/)).toBeOnTheScreen();
    expect(screen.getByText(/Sélection la plus fragile : Inter vs Torino \(50 %\)\. Sans elle : 80 %\./)).toBeOnTheScreen();
  });

  test("la sélection la plus fragile est nommée comme dans la liste (nom reconnu, pas la saisie)", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ probabilite: 85 }), parisLeg({ probabilite: 55 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText(/Sélection la plus fragile : Paris SG vs Marseille \(55 %\)\. Sans elle : 85 %\./);
  });

  test("équipe introuvable : point d'interrogation, message du serveur, aucune probabilité inventée", async () => {
    installFetch({
      "POST /api/analyze": () => ({
        body: {
          legs: [{ etat: "equipe_inconnue", probabilite: null, donneesInsuffisantes: true, message: "Équipe introuvable : vérifiez l'orthographe.", suggestions: { equipe1: ["Arsenal"], equipe2: [] } }],
        },
      }),
    });
    await openApp();
    await addMatch("Arsnal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText(/Équipe introuvable : vérifiez l'orthographe\. Suggestions : Arsenal\./);
    expect(screen.getByText("?")).toBeOnTheScreen();
    expect(screen.getByText("Estimation indicative")).toBeOnTheScreen();
  });

  test("IA indisponible côté serveur : la sélection reste affichée avec un avis clair", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ ia: { statut: "indisponible", code: "TIMEOUT", message: "délai dépassé" } })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText(/relecture par l'IA était indisponible/)).toBeOnTheScreen();
    expect(screen.getAllByText("62 %")).toHaveLength(2); // la sélection et le total du coupon
  });

  test("serveur injoignable : erreur lisible, le coupon est conservé", async () => {
    installFetch({ "POST /api/analyze": () => new TypeError("Failed to fetch") });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText(/Analyse impossible : Impossible de joindre le serveur/);
    expect(screen.getByText("Arsenal vs Chelsea")).toBeOnTheScreen();
  });

  test("deux paris sur le même match : avertissement sur la combinaison", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    expect(screen.queryByText(/portent sur le même match/)).not.toBeOnTheScreen();
    await fireEvent.changeText(team1(), "arsenal");
    await fireEvent.changeText(team2(), "CHELSEA");
    await fireEvent.press(button(/^Ajouter$/));
    await screen.findByText(/portent sur le même match/);
  });

  test("enregistrer le coupon le place dans l'historique et vide le coupon en cours", async () => {
    installFetch({});
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Match nul");
    await fireEvent.press(button("Enregistrer"));
    expect(screen.queryByText(/^Coupon \(/)).not.toBeOnTheScreen();
    await openTab("Historique");
    await screen.findByText("Arsenal vs Chelsea - Match nul");
    await waitFor(async () => expect(await readStored("coupon-pronostics")).toHaveLength(1));
    const saved = await readStored("coupon-pronostics");
    expect(saved[0]).toMatchObject({ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Match nul", statut: "en_attente" });
  });
});

describe("noms reconnus", () => {
  test("après l'analyse, le coupon affiche le nom reconnu, le championnat et rappelle la saisie", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg()] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    expect(screen.queryByText("Saisi : PSG – OM")).not.toBeOnTheScreen(); // rien avant l'analyse
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText("Paris SG vs Marseille")).toBeOnTheScreen();
    expect(screen.getByText("Saisi : PSG – OM")).toBeOnTheScreen();
    expect(screen.getByText(/^Ligue 1 · /)).toBeOnTheScreen();
    expect(screen.queryByText("PSG vs OM")).not.toBeOnTheScreen();
  });

  test("pas de rappel de la saisie quand le nom reconnu n'est que sa version complète (« Arsenal » → « Arsenal FC »)", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ equipe1: "Arsenal FC", equipe2: "Chelsea FC" })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText("Arsenal FC vs Chelsea FC")).toBeOnTheScreen();
    expect(screen.queryByText(/^Saisi :/)).not.toBeOnTheScreen();
  });

  test("deux écritures d'un même match sont reconnues comme le même match une fois analysées", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg(), parisLeg({ typePari: "Match nul", probabilite: 24 })] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    await addMatch("Paris Saint-Germain", "Olympique de Marseille", "Match nul");
    expect(screen.queryByText(/portent sur le même match/)).not.toBeOnTheScreen();
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("Paris SG vs Marseille");
    expect(await screen.findByText(/portent sur le même match/)).toBeOnTheScreen();
  });

  test("l'historique garde les noms reconnus", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [parisLeg()] } }) });
    await openApp();
    await addMatch("PSG", "OM", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText("Paris SG vs Marseille");
    await fireEvent.press(button("Enregistrer"));
    await openTab("Historique");
    expect(await screen.findByText("Paris SG vs Marseille - Plus de 1.5 buts")).toBeOnTheScreen();
    await waitFor(async () => expect(await readStored("coupon-pronostics")).toHaveLength(1));
    expect((await readStored("coupon-pronostics"))[0]).toMatchObject({ equipe1: "Paris SG", equipe2: "Marseille" });
  });
});

describe("analyse en deux temps", () => {
  test("le modèle s'affiche tout de suite, la relecture de l'IA vient ensuite l'ajuster", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = installFetch({
      "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : gate.then(() => ({ body: { legs: [reviewed()] } }))),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    // Temps 1 : le résultat du modèle, sans attendre l'IA
    expect((await screen.findAllByText("60 %")).length).toBeGreaterThan(0);
    expect(screen.getByText(/la relecture par l'IA est en cours/)).toBeOnTheScreen();
    expect(screen.queryByText("Estimation indicative")).not.toBeOnTheScreen();
    expect(button("Analyse…")).toBeDisabled();
    // Temps 2 : la relecture arrive
    release();
    expect((await screen.findAllByText("63 %")).length).toBeGreaterThan(0); // 62,5 arrondi
    expect(screen.queryByText("60 %")).not.toBeOnTheScreen();
    expect(screen.queryByText(/la relecture par l'IA est en cours/)).not.toBeOnTheScreen();
    expect(button("Analyser")).toBeEnabled();
    const posts = analyseurCalls(calls);
    expect(posts).toHaveLength(2);
    expect(posts[0].body).toEqual({ ia: false, legs: [{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }] });
    expect(posts[1].body).toEqual({ legs: [{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }] }); // sans « ia: false »
  });

  test("les détails montrent le texte de l'IA une fois la relecture arrivée", async () => {
    installFetch({ "POST /api/analyze": (body) => ({ body: { legs: [body.ia === false ? quick() : reviewed()] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("63 %");
    await fireEvent.press(button("Détails"));
    expect(screen.getByText("Texte relu par l'IA.")).toBeOnTheScreen();
    expect(screen.queryByText("Texte du modèle.")).not.toBeOnTheScreen();
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
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("63 %");
    expect(screen.getByText("11 %")).toBeOnTheScreen();
    const posts = analyseurCalls(calls);
    expect(posts).toHaveLength(2);
    expect(posts[1].body.legs).toEqual([{ equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 1.5 buts" }]);
  });

  test("la relecture échoue : le résultat du modèle reste affiché, avec la raison", async () => {
    installFetch({
      "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : { status: 429, body: { error: "Trop de demandes : réessayez dans 12 s." } }),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    expect(
      await screen.findByText(/La relecture par l'IA n'a pas pu être faite \(Trop de demandes : réessayez dans 12 s\.\) : le modèle statistique répond seul\./),
    ).toBeOnTheScreen();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Analyse impossible/)).not.toBeOnTheScreen();
    expect(button("Analyser")).toBeEnabled();
  });

  test("le serveur tombe pendant la relecture : même résultat, le modèle reste affiché", async () => {
    installFetch({ "POST /api/analyze": (body) => (body.ia === false ? { body: { legs: [quick()] } } : new TypeError("Failed to fetch")) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText(/La relecture par l'IA n'a pas pu être faite \(Impossible de joindre le serveur/)).toBeOnTheScreen();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
  });

  test("la relecture est indisponible côté serveur : le modèle reste, avec l'avis habituel", async () => {
    installFetch({
      "POST /api/analyze": (body) => ({
        body: { legs: [body.ia === false ? quick() : reviewed({ probabilite: 60, ajustementIA: 0, ia: { statut: "indisponible", code: "TIMEOUT", message: "délai dépassé" } })] },
      }),
    });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText(/relecture par l'IA était indisponible pour une sélection/)).toBeOnTheScreen();
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
  });

  test("IA désactivée sur le serveur : une seule requête, rien à relancer", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ body: { legs: [quick({ ia: { statut: "desactivee" } })] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("60 %");
    expect(analyseurCalls(calls)).toHaveLength(1);
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
    await fireEvent.press(button("Analyser"));
    await waitFor(() => expect(button("Analyser")).toBeEnabled());
    expect(screen.getAllByText("60 %").length).toBeGreaterThan(0);
    expect(screen.queryByText("?")).not.toBeOnTheScreen();
  });

  test("premier temps en échec : message d'erreur comme avant, aucune relecture tentée", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ status: 503, body: { error: "Aucune source de données n'est disponible pour le moment." } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findByText(/Analyse impossible : Aucune source de données n'est disponible/);
    expect(analyseurCalls(calls)).toHaveLength(1);
  });

  test("plus de douze sélections : chaque temps se fait par séries de douze", async () => {
    const calls = installFetch({
      "POST /api/analyze": (body) => ({
        body: { legs: body.legs.map((l: { equipe1: string; equipe2: string }) => (body.ia === false ? quick({ equipe1: l.equipe1, equipe2: l.equipe2 }) : reviewed({ equipe1: l.equipe1, equipe2: l.equipe2 }))) },
      }),
    });
    await openApp();
    for (let i = 0; i < 13; i += 1) await addMatch(`Dom${i}`, `Ext${i}`, "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await waitFor(() => expect(screen.getAllByText("63 %").length).toBeGreaterThan(12), { timeout: 5000 });
    const sizes = analyseurCalls(calls).map((c) => [c.body.ia === false ? "modele" : "ia", c.body.legs.length]);
    expect(sizes).toEqual([
      ["modele", 12],
      ["modele", 1],
      ["ia", 12],
      ["ia", 1],
    ]);
  }, 20000);
});

describe("choix du type de pari depuis une analyse", () => {
  test("le type choisi est celui envoyé au serveur", async () => {
    const calls = installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg({ typePari: "Les deux équipes marquent" })] } }) });
    await openApp();
    await chooseBet("Les deux équipes marquent");
    await fireEvent.changeText(team1(), "Arsenal");
    await fireEvent.changeText(team2(), "Chelsea");
    await fireEvent.press(button(/^Ajouter$/));
    await screen.findByText("Arsenal vs Chelsea");
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("62 %");
    expect(calls[0].body.legs[0].typePari).toBe("Les deux équipes marquent");
  });
});

// Un coupon bâti depuis le Top Matchs se laisse analyser comme les autres.
describe("coupon bâti depuis le Top Matchs", () => {
  test("un match déjà analysé par le serveur peut être relancé avec « Analyser »", async () => {
    const calls = installFetch({
      "GET /api/top-matches": () => ({ body: topPayload() }),
      "POST /api/analyze": () => ({ body: { legs: [okLeg({ probabilite: 70 })] } }),
    });
    await openApp();
    await openTab("Top Matchs");
    await screen.findByText("Arsenal vs Chelsea");
    await fireEvent.press(screen.getAllByRole("button", { name: "Ajouter ce pronostic" })[0]);
    await openTab("Mon coupon");
    await fireEvent.press(button("Analyser"));
    await waitFor(() => expect(screen.getAllByText("70 %").length).toBeGreaterThan(0));
    expect(calls.filter((c) => c.path === "/api/analyze")).toHaveLength(1);
  });
});

// Ligue des champions, autres championnats : le serveur analyse maintenant n'importe quel match, en signalant ceux qui sont moins précis.
describe("clubs de championnats différents", () => {
  test("l'avertissement du serveur est toujours visible sous le pari concerné, et le total le rappelle", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [cupLeg(), okLeg({ equipe1: "Inter", equipe2: "Torino", typePari: "Match nul", probabilite: 30 })] } }) });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Inter", "Torino", "Match nul");
    expect(screen.queryByText(CROSS_MESSAGE)).not.toBeOnTheScreen(); // rien avant l'analyse
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText(CROSS_MESSAGE)).toBeOnTheScreen(); // sans avoir ouvert « Détails »
    expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1); // Inter – Torino n'est pas concerné
    expect(screen.getByText(/^UEFA Champions League · /)).toBeOnTheScreen();
    expect(screen.getByText("1 sélection oppose des clubs de championnats différents : son estimation est moins précise, le pourcentage combiné aussi.")).toBeOnTheScreen();
  });

  test("deux sélections concernées : le total le dit au pluriel, chaque pari garde son avertissement", async () => {
    installFetch({
      "POST /api/analyze": () => ({ body: { legs: [cupLeg(), cupLeg({ equipe1: "Inter", equipe2: "Benfica", typePari: "Match nul", probabilite: 30, comparaisonEntreChampionnats: cross({ message: CROSS_WEAK_MESSAGE }) })] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Inter", "Benfica", "Match nul");
    await fireEvent.press(button("Analyser"));
    expect(await screen.findByText(CROSS_MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText(CROSS_WEAK_MESSAGE)).toBeOnTheScreen(); // le texte du serveur, tel quel (club d'un championnat non suivi)
    expect(screen.getByText(/2 sélections opposent des clubs de championnats différents/)).toBeOnTheScreen();
  });

  test("la relecture de l'IA ne fait pas disparaître l'avertissement", async () => {
    installFetch({
      "POST /api/analyze": (body) => ({ body: { legs: [body.ia === false ? quick({ comparaisonEntreChampionnats: cross() }) : reviewed({ comparaisonEntreChampionnats: cross() })] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("63 %"); // relecture arrivée
    expect(screen.getAllByText(CROSS_MESSAGE)).toHaveLength(1);
  });

  test("deux clubs du même championnat : aucun avertissement de ce genre", async () => {
    installFetch({ "POST /api/analyze": () => ({ body: { legs: [okLeg()] } }) });
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Plus de 1.5 buts");
    await fireEvent.press(button("Analyser"));
    await screen.findAllByText("62 %");
    expect(screen.queryByText(/oppos(e|ent) des clubs de championnats différents/)).not.toBeOnTheScreen(); // la mise en garde sur le total
    expect(screen.queryByText(/ne jouent pas dans le même championnat/)).not.toBeOnTheScreen(); // celle du pari
  });

  test("une sélection dont l'analyse a échoué ne compte pas parmi celles à signaler", async () => {
    installFetch({
      "POST /api/analyze": () => ({ body: { legs: [cupLeg(), { etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable : vérifiez l'orthographe.", suggestions: { equipe1: [], equipe2: [] } }] } }),
    });
    await openApp();
    await addMatch("Arsenal", "Real Madrid", "Plus de 1.5 buts");
    await addMatch("Xyz", "Abc", "Match nul");
    await fireEvent.press(button("Analyser"));
    await screen.findByText(/Équipe introuvable/);
    expect(screen.getByText(/^1 sélection oppose des clubs/)).toBeOnTheScreen();
  });

  test("le texte d'aide rappelle que les deux clubs peuvent venir de championnats différents", async () => {
    installFetch({});
    await openApp();
    expect(screen.getByText(/Les deux clubs peuvent venir de championnats différents \(Ligue des champions, par exemple\)/)).toBeOnTheScreen();
  });
});
