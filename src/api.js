// Appels du serveur : adresse, délai maximal et messages d'erreur lisibles.

// Adresse du serveur : modifiable au moment de la construction avec REACT_APP_API_URL.
const API_BASE = (process.env.REACT_APP_API_URL || "https://analyseur-foot-api.onrender.com").replace(/\/+$/, "");

export async function callApi(path, { method = "GET", body, timeoutMs = 70000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    if (!res.ok) {
      const err = new Error((json && json.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Le serveur met trop de temps à répondre. Réessayez dans un instant.");
    if (e instanceof TypeError) throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
