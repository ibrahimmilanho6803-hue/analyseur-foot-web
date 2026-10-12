import { API_BASE } from "./config";

export interface CallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiError extends Error {
  status?: number;
}

// Appel du serveur avec délai maximal et messages d'erreur lisibles (même comportement que le site).
export async function callApi<T = any>(path: string, { method = "GET", body, timeoutMs = 70000 }: CallOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const TROP_LONG = "Le serveur met trop de temps à répondre. Réessayez dans un instant.";
  try {
    let res: Response;
    try {
      res = await fetch(API_BASE + path, {
        method,
        signal: ctrl.signal,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Tout ce que fetch() refuse avant d'avoir une réponse est un problème de connexion (réseau coupé, serveur injoignable) ou le
      // délai dépassé. Selon le moteur, l'erreur a des formes différentes (TypeError dans un navigateur, « fetch failed: java.net.
      // UnknownHostException… » avec le fetch d'Expo sur Android) : on n'affiche jamais ce texte technique.
      if (timedOut) throw new Error(TROP_LONG);
      throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion.");
    }
    let json: any = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (timedOut) throw new Error(TROP_LONG);
    if (!res.ok) {
      const err: ApiError = new Error((json && json.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}
