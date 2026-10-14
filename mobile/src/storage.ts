// Stockage sur le téléphone (AsyncStorage). Toute lecture ou écriture qui échoue est ignorée : l'application fonctionne sans.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Catalog } from "./suggest";
import type { Pronostic } from "./types";

// Mêmes clés que sur le site.
export const HISTORY_KEY = "coupon-pronostics";
export const CATALOG_KEY = "coupon-clubs";

// Version de la liste de clubs gardée sur le téléphone. 2 : le serveur propose les clubs de tous les championnats suivis (une trentaine,
// dont les coupes d'Europe) et non plus seulement les dix principaux ; une liste enregistrée par une version précédente de
// l'application est ignorée, pour ne pas faire croire pendant un jour qu'un club n'est pas suivi.
export const CATALOG_VERSION = 2;

export interface SavedCatalog {
  v?: number;
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
    if (saved && saved.v === CATALOG_VERSION && Number.isFinite(saved.at) && saved.data && Array.isArray(saved.data.equipes)) return saved as SavedCatalog;
  } catch (e) {
    // ignoré
  }
  return null;
}

export async function saveCatalog(at: number, data: Catalog): Promise<void> {
  try {
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify({ v: CATALOG_VERSION, at, data }));
  } catch (e) {
    // ignoré
  }
}
