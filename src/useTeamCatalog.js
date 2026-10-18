import { useState, useEffect, useRef, useCallback } from "react";
import { callApi } from "./api";
import { buildIndex } from "./suggest";

// ---------- Liste des clubs pour les suggestions de saisie ----------
const CATALOG_KEY = "coupon-clubs";
// Version de la liste gardée sur l'appareil. 2 : le serveur propose les clubs de tous les championnats suivis (une trentaine, dont les
// coupes d'Europe) et non plus seulement les dix principaux ; une liste enregistrée par une version précédente est ignorée, pour ne pas
// faire croire pendant un jour qu'un club n'est pas suivi.
const CATALOG_VERSION = 2;
const CATALOG_TTL_MS = 24 * 3600000; // liste complète : redemandée au plus une fois par jour
const CATALOG_RETRY_MS = 60000; // liste incomplète (championnats en chargement) ou serveur injoignable : un essai par minute au plus

function savedCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_KEY));
    if (saved && saved.v === CATALOG_VERSION && Number.isFinite(saved.at) && saved.data && Array.isArray(saved.data.equipes)) return saved;
  } catch (e) {}
  return null;
}

// Charge GET /api/teams (gardé sur l'appareil) pour proposer des clubs pendant la saisie. Aucune erreur n'est affichée : sans liste,
// les champs restent de simples champs texte et le serveur reconnaît le nom saisi comme avant.
export function useTeamCatalog() {
  const [state, setState] = useState(() => {
    const saved = savedCatalog();
    return saved ? { index: buildIndex(saved.data), complete: Boolean(saved.data.complet), at: saved.at } : { index: null, complete: false, at: 0 };
  });
  const latest = useRef(state);
  latest.current = state;
  const busy = useRef(false);
  const lastTry = useRef(0);

  const refresh = useCallback(async () => {
    const cur = latest.current;
    const age = Date.now() - cur.at;
    const stale = !cur.index || age > (cur.complete ? CATALOG_TTL_MS : CATALOG_RETRY_MS);
    if (!stale || busy.current || (lastTry.current && Date.now() - lastTry.current < CATALOG_RETRY_MS)) return;
    busy.current = true;
    lastTry.current = Date.now();
    try {
      const data = await callApi("/api/teams", { timeoutMs: 20000 });
      if (!data || !Array.isArray(data.equipes)) return;
      const at = Date.now();
      setState({ index: buildIndex(data), complete: Boolean(data.complet), at });
      try { localStorage.setItem(CATALOG_KEY, JSON.stringify({ v: CATALOG_VERSION, at, data })); } catch (e) {}
    } catch (e) {
      // silencieux : voir plus haut
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { index: state.index, complete: state.complete, refresh };
}
