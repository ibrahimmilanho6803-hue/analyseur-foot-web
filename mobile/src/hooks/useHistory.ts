import { useCallback, useEffect, useState } from "react";
import { loadHistory, saveHistory } from "../storage";
import type { Pronostic } from "../types";

// Historique des coupons enregistrés, gardé sur le téléphone. `loading` reste vrai jusqu'à la fin de la lecture.
export function useHistory() {
  const [pronostics, setPronostics] = useState<Pronostic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadHistory().then((list) => {
      if (!alive) return;
      setPronostics(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (next: Pronostic[]) => {
    setPronostics(next);
    await saveHistory(next);
  }, []);

  return { pronostics, persist, loading };
}
