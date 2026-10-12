import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../api";
import { loadCatalog, saveCatalog } from "../storage";
import { buildIndex } from "../suggest";
import type { Catalog, IndexedTeam } from "../suggest";

// Liste des clubs pour les suggestions de saisie.
const CATALOG_TTL_MS = 24 * 3600000; // liste complète : redemandée au plus une fois par jour
const CATALOG_RETRY_MS = 60000; // liste incomplète (championnats en chargement) ou serveur injoignable : un essai par minute au plus

interface CatalogState {
  index: IndexedTeam[] | null;
  complete: boolean;
  at: number;
}

const EMPTY: CatalogState = { index: null, complete: false, at: 0 };

// Charge GET /api/teams (gardé sur le téléphone) pour proposer des clubs pendant la saisie. Aucune erreur n'est affichée : sans liste,
// les champs restent de simples champs texte et le serveur reconnaît le nom saisi comme avant.
export function useTeamCatalog() {
  const [state, setState] = useState<CatalogState>(EMPTY);
  const latest = useRef<CatalogState>(EMPTY);
  const busy = useRef(false);
  const lastTry = useRef(0);
  const alive = useRef(true);

  const apply = useCallback((next: CatalogState) => {
    latest.current = next;
    if (alive.current) setState(next);
  }, []);

  const refresh = useCallback(async () => {
    const cur = latest.current;
    const age = Date.now() - cur.at;
    const stale = !cur.index || age > (cur.complete ? CATALOG_TTL_MS : CATALOG_RETRY_MS);
    if (!stale || busy.current || (lastTry.current && Date.now() - lastTry.current < CATALOG_RETRY_MS)) return;
    busy.current = true;
    lastTry.current = Date.now();
    try {
      const data = await callApi<Catalog>("/api/teams", { timeoutMs: 20000 });
      if (!data || !Array.isArray(data.equipes)) return;
      const at = Date.now();
      apply({ index: buildIndex(data), complete: Boolean(data.complet), at });
      await saveCatalog(at, data);
    } catch (e) {
      // silencieux : voir plus haut
    } finally {
      busy.current = false;
    }
  }, [apply]);

  // Au démarrage : la liste gardée sur le téléphone sert tout de suite, puis le serveur est interrogé si elle est trop ancienne.
  useEffect(() => {
    alive.current = true;
    (async () => {
      const saved = await loadCatalog();
      if (saved && alive.current && !latest.current.index) {
        apply({ index: buildIndex(saved.data), complete: Boolean(saved.data.complet), at: saved.at });
      }
      await refresh();
    })();
    return () => {
      alive.current = false;
    };
  }, [apply, refresh]);

  return { index: state.index, complete: state.complete, refresh };
}
