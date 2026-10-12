// Stockage sur le téléphone (AsyncStorage). Toute lecture ou écriture qui échoue est ignorée : l'application fonctionne sans.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Catalog } from "./suggest";
import type { Pronostic } from "./types";

// Mêmes clés que sur le site.
export const HISTORY_KEY = "coupon-pronostics";
export const CATALOG_KEY = "coupon-clubs";

export interface SavedCatalog {
  at: number;
  data: Catalog & { equipes: NonNullable<Catalog["equipes"]> };
}

export async function loadHistory(): Promise<Pronostic[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Pronostic[]) : [];
  } catch (e) {
    return [];
  }
}

export async function saveHistory(list: Pronostic[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    // ignoré : l'historique reste affiché pendant cette session
  }
}

// Liste des clubs gardée sur le téléphone ; une valeur abîmée est ignorée.
export async function loadCatalog(): Promise<SavedCatalog | null> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && Number.isFinite(saved.at) && saved.data && Array.isArray(saved.data.equipes)) return saved as SavedCatalog;
  } catch (e) {
    // ignoré
  }
  return null;
}

export async function saveCatalog(at: number, data: Catalog): Promise<void> {
  try {
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify({ at, data }));
  } catch (e) {
    // ignoré
  }
}
