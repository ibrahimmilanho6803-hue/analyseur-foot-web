// Aides communes aux tests d'écrans : ouvrir l'application, saisir un match, lire le stockage de l'appareil.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import AnalyseurApp from "../src/AnalyseurApp";
import { CATALOG_VERSION } from "../src/storage";
import { CATALOG } from "./fixtures";

export async function openApp() {
  await render(<AnalyseurApp />);
  await screen.findByText("Analyseur Foot Pro");
}

export const team1 = () => screen.getByLabelText("Équipe 1 (à domicile)");
export const team2 = () => screen.getByLabelText("Équipe 2 (à l'extérieur)");
export const tab = (name: string) => screen.getByRole("tab", { name });
export const button = (name: string | RegExp) => screen.getByRole("button", { name });

export async function openTab(name: string) {
  await fireEvent.press(tab(name));
}

/** Ouvre la feuille du sélecteur de pari. */
export const openBetSheet = () => fireEvent.press(screen.getByRole("button", { name: /^Type de pari/ }));

/** Choisit un type de pari dans la feuille du sélecteur : par la recherche, qui déplie toutes les familles (une centaine de paris). */
export async function chooseBet(bet: string) {
  await openBetSheet();
  await fireEvent.changeText(await screen.findByLabelText("Rechercher un pari"), bet);
  await fireEvent.press(await screen.findByRole("radio", { name: bet }));
}

/** Saisit un match dans « Mon coupon » et l'ajoute (saisie directe : rapide, sans simuler chaque touche). */
export async function addMatch(home: string, away: string, bet?: string) {
  await fireEvent.changeText(team1(), home);
  await fireEvent.changeText(team2(), away);
  if (bet) await chooseBet(bet);
  await fireEvent.press(screen.getByRole("button", { name: /^Ajouter$/ }));
  await screen.findByText(`${home} vs ${away}`);
}

/** Saisit un match dans l'onglet « Auto » et l'ajoute à la liste à générer. */
export async function typeAutoMatch(home: string, away: string) {
  await fireEvent.changeText(screen.getByLabelText("Équipe 1 du match à générer"), home);
  await fireEvent.changeText(screen.getByLabelText("Équipe 2 du match à générer"), away);
  await fireEvent.press(screen.getByRole("button", { name: /^Ajouter$/ }));
}

/** Les suggestions affichées sous le champ (hors options de la feuille « Type de pari »). */
export const suggestionOptions = () => within(screen.getByLabelText("Suggestions de clubs")).getAllByRole("option");
export const suggestionList = () => screen.queryByLabelText("Suggestions de clubs");

// Stockage de l'appareil (AsyncStorage simulé en mémoire).
export const resetStorage = () => AsyncStorage.clear();
export async function readStored(key: string) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
export const savedCatalog = () => readStored("coupon-clubs");
export const seedCatalog = (ageMs: number, over: Record<string, unknown> = {}) =>
  AsyncStorage.setItem("coupon-clubs", JSON.stringify({ v: CATALOG_VERSION, at: Date.now() - ageMs, data: { ...CATALOG, ...over } }));
export const withCatalog = (over: Record<string, unknown> = {}) => ({ "GET /api/teams": () => ({ body: { ...CATALOG, ...over } }) });

export const HISTORY_KEY = "coupon-pronostics";

/** Un pari de l'historique (par défaut : en attente, enregistré le 2 octobre à midi UTC). */
export function pronostic(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    couponId: "c1",
    equipe1: "Arsenal",
    equipe2: "Chelsea",
    typePari: "Match nul",
    cote: null,
    matchDate: "2026-10-01",
    statut: "en_attente",
    date: "2026-10-02T12:00:00.000Z",
    ...over,
  };
}
export const seedHistory = (list: unknown[]) => AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
export const savedHistory = () => readStored(HISTORY_KEY);
