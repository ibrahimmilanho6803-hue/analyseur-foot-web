import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler, Keyboard } from "react-native";
import AnalyseurApp, { DISCLAIMER } from "../src/AnalyseurApp";
import { openApp, openTab, resetStorage, tab } from "../test-support/app";
import { installFetch } from "../test-support/fakeServer";
import { topPayload } from "../test-support/fixtures";

beforeEach(async () => {
  await resetStorage();
  installFetch({ "GET /api/top-matches": () => ({ body: topPayload() }) });
});
afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe("navigation", () => {
  test("l'application s'ouvre sur « Mon coupon », avec les quatre onglets", async () => {
    await openApp();
    expect(tab("Mon coupon")).toBeSelected();
    for (const name of ["Top Matchs", "Auto", "Historique"]) expect(tab(name)).not.toBeSelected();
    expect(screen.getByText("Ajouter un match")).toBeOnTheScreen();
  });

  test("chaque onglet affiche son écran", async () => {
    await openApp();
    await openTab("Auto");
    expect(tab("Auto")).toBeSelected();
    expect(screen.getByText("Génération automatique")).toBeOnTheScreen();
    await openTab("Historique");
    expect(screen.getByText("Aucun coupon")).toBeOnTheScreen();
    await openTab("Top Matchs");
    expect(await screen.findByText("Arsenal vs Chelsea")).toBeOnTheScreen();
    await openTab("Mon coupon");
    expect(screen.getByText("Ajouter un match")).toBeOnTheScreen();
  });

  test("le rappel « jamais des certitudes » est visible sur chaque onglet", async () => {
    await openApp();
    for (const name of ["Mon coupon", "Auto", "Historique", "Top Matchs"]) {
      await openTab(name);
      expect(screen.getByText(DISCLAIMER)).toBeOnTheScreen();
    }
    expect(DISCLAIMER).toMatch(/ne sont jamais des certitudes/);
    expect(DISCLAIMER).toMatch(/Jouez avec modération/);
  });

  test("« Chargement… » tant que l'historique du téléphone n'est pas lu", async () => {
    // La lecture de l'historique est retenue ; celle de la liste des clubs passe normalement.
    const getItem = AsyncStorage.getItem as jest.Mock;
    const normal = getItem.getMockImplementation();
    let release: (v: string | null) => void = () => {};
    getItem.mockImplementation((key: string) =>
      key === "coupon-pronostics"
        ? new Promise<string | null>((resolve) => {
            release = resolve;
          })
        : normal?.(key),
    );
    try {
      await render(<AnalyseurApp />);
      expect(screen.getByText("Chargement…")).toBeOnTheScreen();
      expect(screen.queryByText("Analyseur Foot Pro")).not.toBeOnTheScreen();
      await act(async () => release(null));
      expect(await screen.findByText("Analyseur Foot Pro")).toBeOnTheScreen();
    } finally {
      getItem.mockImplementation(normal);
    }
  });
});

describe("bouton retour d'Android", () => {
  test("ramène à « Mon coupon » ; ne quitte l'application que depuis cet onglet", async () => {
    let onBack: () => boolean = () => false;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_event: string, handler: () => boolean) => {
      onBack = handler;
      return { remove: () => {} };
    }) as never);
    await openApp();
    await openTab("Historique");
    let handled = false;
    await act(async () => {
      handled = onBack();
    });
    expect(handled).toBe(true);
    expect(tab("Mon coupon")).toBeSelected();
    await act(async () => {
      handled = onBack();
    });
    expect(handled).toBe(false); // laissé à Android : l'application se ferme
  });
});

describe("clavier", () => {
  test("la barre d'onglets se masque tant que le clavier est affiché", async () => {
    const listeners: Record<string, ((e?: unknown) => void)[]> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, handler: (e?: unknown) => void) => {
      (listeners[event] ||= []).push(handler);
      return { remove: () => {} };
    }) as never);
    const emit = (event: string) =>
      act(async () => {
        for (const handler of listeners[event] || []) handler({ endCoordinates: { screenX: 0, screenY: 500, width: 360, height: 300 }, duration: 0 });
      });
    await openApp();
    expect(tab("Mon coupon")).toBeOnTheScreen();
    await emit("keyboardDidShow");
    expect(screen.queryByRole("tab", { name: "Mon coupon" })).not.toBeOnTheScreen();
    await emit("keyboardDidHide");
    expect(tab("Mon coupon")).toBeOnTheScreen();
  });

  test("les champs de saisie portent un nom lisible par les lecteurs d'écran", async () => {
    await openApp();
    await fireEvent.press(screen.getByRole("button", { name: /^Type de pari/ }));
    expect(await screen.findByRole("radio", { name: "Match nul" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Équipe 1 (à domicile)")).toBeOnTheScreen();
    expect(screen.getByLabelText("Équipe 2 (à l'extérieur)")).toBeOnTheScreen();
  });
});
