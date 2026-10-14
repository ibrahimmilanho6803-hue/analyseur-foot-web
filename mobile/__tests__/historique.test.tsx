import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { addMatch, button, openApp, openTab, pronostic, resetStorage, savedHistory, seedHistory } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";

beforeEach(async () => {
  await resetStorage();
  installFetch({});
});
afterEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

// Deux coupons : le plus ancien a un pari gagné et un pari en attente, le plus récent un pari perdu.
const twoCoupons = () => [
  pronostic({ id: "a1", couponId: "c-ancien", equipe1: "Arsenal", equipe2: "Chelsea", statut: "gagne", date: "2026-10-02T12:00:00.000Z" }),
  pronostic({ id: "a2", couponId: "c-ancien", equipe1: "Inter", equipe2: "Torino", typePari: "Plus de 0.5 buts", statut: "en_attente", date: "2026-10-02T12:00:00.000Z" }),
  pronostic({ id: "b1", couponId: "c-recent", equipe1: "Paris SG", equipe2: "Marseille", typePari: "Victoire domicile", statut: "perdu", date: "2026-10-05T12:00:00.000Z" }),
];

describe("en-tête", () => {
  test("sans coupon clôturé : pas de pourcentage inventé", async () => {
    await openApp();
    expect(screen.getByText(/Réussite/)).toHaveTextContent("Réussite : -");
    expect(screen.getByText(/Clôturés/)).toHaveTextContent("Clôturés : 0");
  });

  test("le taux de réussite se calcule sur les paris clôturés seulement", async () => {
    await seedHistory(twoCoupons());
    await openApp();
    expect(screen.getByText(/Réussite/)).toHaveTextContent("Réussite : 50 %"); // 1 gagné sur 2 clôturés ; le pari en attente ne compte pas
    expect(screen.getByText(/Clôturés/)).toHaveTextContent("Clôturés : 2");
  });
});

describe("onglet Historique", () => {
  test("sans coupon : message simple", async () => {
    await openApp();
    await openTab("Historique");
    expect(screen.getByText("Aucun coupon")).toBeOnTheScreen();
  });

  test("les coupons sont groupés, le plus récent en premier, avec leur état", async () => {
    await seedHistory(twoCoupons());
    await openApp();
    await openTab("Historique");
    const days = screen.getAllByText(/^\d{2}\/\d{2}\/2026$/).map((n) => n.props.children);
    expect(days).toEqual(["05/10/2026", "02/10/2026"]); // du plus récent au plus ancien
    expect(screen.getByText("Perdu")).toBeOnTheScreen(); // le coupon récent
    expect(screen.getByText("En attente")).toBeOnTheScreen(); // l'ancien : il reste un pari à clôturer
    expect(screen.getByText("Arsenal vs Chelsea - Match nul")).toBeOnTheScreen();
    expect(screen.getByText("Inter vs Torino - Plus de 0.5 buts")).toBeOnTheScreen();
    expect(screen.getByText("Paris SG vs Marseille - Victoire domicile")).toBeOnTheScreen();
  });

  test("marquer le dernier pari d'un coupon gagné le fait passer à « Gagné » et met à jour la réussite", async () => {
    await seedHistory(twoCoupons());
    await openApp();
    await openTab("Historique");
    await fireEvent.press(button("Marquer comme gagné")); // un seul pari est encore en attente
    expect(await screen.findByText("Gagné")).toBeOnTheScreen();
    expect(screen.queryByText("En attente")).not.toBeOnTheScreen();
    expect(screen.getByText(/Réussite/)).toHaveTextContent("Réussite : 67 %"); // 2 gagnés sur 3
    expect(screen.getByText(/Clôturés/)).toHaveTextContent("Clôturés : 3");
    await waitFor(async () => expect((await savedHistory()).find((p: { id: string }) => p.id === "a2").statut).toBe("gagne"));
  });

  test("un seul pari perdu suffit à faire perdre le coupon", async () => {
    await seedHistory([
      pronostic({ id: "x1", couponId: "c", equipe1: "Arsenal", equipe2: "Chelsea" }),
      pronostic({ id: "x2", couponId: "c", equipe1: "Inter", equipe2: "Torino" }),
    ]);
    await openApp();
    await openTab("Historique");
    expect(screen.getByText("En attente")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole("button", { name: "Marquer comme gagné" })[0]);
    await fireEvent.press(button("Marquer comme perdu"));
    expect(await screen.findByText("Perdu")).toBeOnTheScreen();
    expect(screen.getByText("V")).toBeOnTheScreen();
    expect(screen.getByText("X")).toBeOnTheScreen();
  });

  test("supprimer un pari le retire de l'écran et du téléphone", async () => {
    await seedHistory(twoCoupons());
    await openApp();
    await openTab("Historique");
    await fireEvent.press(screen.getAllByRole("button", { name: "Supprimer ce pari" })[0]);
    await waitFor(async () => expect(await savedHistory()).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: "Supprimer ce pari" })).toHaveLength(2);
  });

  test("l'historique est conservé quand on ferme puis rouvre l'application", async () => {
    await openApp();
    await addMatch("Arsenal", "Chelsea", "Match nul");
    await fireEvent.press(button("Enregistrer"));
    await waitFor(async () => expect(await savedHistory()).toHaveLength(1));
    await screen.unmount();

    await openApp();
    await openTab("Historique");
    expect(await screen.findByText("Arsenal vs Chelsea - Match nul")).toBeOnTheScreen();
  });

  test("un contenu abîmé sur le téléphone est ignoré : l'application démarre avec un historique vide", async () => {
    await AsyncStorage.setItem("coupon-pronostics", "{pas du json");
    await openApp();
    await openTab("Historique");
    expect(screen.getByText("Aucun coupon")).toBeOnTheScreen();
  });
});

describe("paris à ligne entière : remboursés", () => {
  const refundPair = (overA: Record<string, unknown> = {}, overB: Record<string, unknown> = {}) => [
    pronostic({ id: "r1", couponId: "c", equipe1: "Arsenal", equipe2: "Chelsea", typePari: "Plus de 2 buts", ...overA }),
    pronostic({ id: "r2", couponId: "c", equipe1: "Inter", equipe2: "Torino", typePari: "Plus de 1.5 buts", ...overB }),
  ];

  test("seul un pari à ligne entière propose « remboursé »", async () => {
    await seedHistory(refundPair());
    await openApp();
    await openTab("Historique");
    expect(screen.getAllByRole("button", { name: "Marquer comme gagné" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Marquer comme perdu" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Marquer comme remboursé" })).toHaveLength(1); // « Plus de 2 buts » seulement
  });

  test("un pari remboursé est enregistré, affiché « R », et ne fait pas perdre le coupon", async () => {
    await seedHistory(refundPair({}, { statut: "gagne" }));
    await openApp();
    await openTab("Historique");
    await fireEvent.press(button("Marquer comme remboursé"));
    expect(await screen.findByText("Gagné")).toBeOnTheScreen(); // un pari gagné, un remboursé : le coupon est gagné
    expect(screen.getByText("R")).toBeOnTheScreen();
    expect(screen.getByText("V")).toBeOnTheScreen();
    await waitFor(async () => expect((await savedHistory()).find((p: { id: string }) => p.id === "r1").statut).toBe("rembourse"));
  });

  test("tous les paris remboursés : le coupon est « Remboursé » ; un pari perdu l'emporte sur un remboursé", async () => {
    await seedHistory([
      ...refundPair({ statut: "rembourse" }, { typePari: "Moins de 3 buts", statut: "rembourse" }),
      pronostic({ id: "q1", couponId: "d", equipe1: "Paris SG", equipe2: "Marseille", typePari: "Plus de 1 but", statut: "rembourse", date: "2026-10-05T12:00:00.000Z" }),
      pronostic({ id: "q2", couponId: "d", equipe1: "Real Madrid", equipe2: "Getafe", typePari: "Match nul", statut: "perdu", date: "2026-10-05T12:00:00.000Z" }),
    ]);
    await openApp();
    await openTab("Historique");
    expect(screen.getByText("Remboursé")).toBeOnTheScreen(); // le coupon c
    expect(screen.getByText("Perdu")).toBeOnTheScreen(); // le coupon d
  });

  test("un pari remboursé ne compte ni dans la réussite ni dans les paris clôturés", async () => {
    await seedHistory([
      pronostic({ id: "a", couponId: "c1", typePari: "Plus de 2 buts", statut: "rembourse" }),
      pronostic({ id: "b", couponId: "c2", typePari: "Match nul", statut: "gagne" }),
      pronostic({ id: "c", couponId: "c3", typePari: "Match nul", statut: "perdu" }),
      pronostic({ id: "d", couponId: "c4", typePari: "Match nul", statut: "en_attente" }),
    ]);
    await openApp();
    expect(screen.getByText(/Réussite/)).toHaveTextContent("Réussite : 50 %"); // 1 gagné sur 2 réglés
    expect(screen.getByText(/Clôturés/)).toHaveTextContent("Clôturés : 2");
  });
});
