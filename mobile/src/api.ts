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
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (!res.ok) {
      const err: ApiError = new Error((json && json.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json as T;
  } catch (e) {
    if (e && (e as { name?: string }).name === "AbortError") throw new Error("Le serveur met trop de temps à répondre. Réessayez dans un instant.");
    // Réseau coupé, serveur injoignable : React Native lève une TypeError (« Network request failed »).
    if (e instanceof TypeError) throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
