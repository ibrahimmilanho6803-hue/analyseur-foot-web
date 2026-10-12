// Faux serveur pour les tests : chaque appel est enregistré, aucun appel réseau réel.
// La liste des clubs (suggestions de saisie) est demandée au démarrage : par défaut elle est vide, et ses appels sont notés à part
// (`calls.catalog`) pour ne pas se mélanger à ceux que chaque test vérifie.

export interface FakeResponse {
  status?: number;
  body?: unknown;
}
export type Handler = (body?: any) => FakeResponse | Error | Promise<FakeResponse | Error>;

export interface Call {
  url: string;
  path: string;
  method: string;
  body?: any;
}
export interface Calls extends Array<Call> {
  catalog: Call[];
}

const EMPTY_CATALOG = { complet: true, championnats: [], equipes: [] };

export function installFetch(routes: Record<string, Handler>): Calls {
  const calls = [] as unknown as Calls;
  calls.catalog = [];
  (globalThis as any).fetch = jest.fn((url: string, opts: { method?: string; body?: string } = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const call: Call = { url: String(url), path, method, body: opts.body ? JSON.parse(opts.body) : undefined };
    if (method === "GET" && path === "/api/teams") {
      calls.catalog.push(call);
      if (!routes["GET /api/teams"]) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(EMPTY_CATALOG) });
    } else {
      calls.push(call);
    }
    const handler = routes[`${method} ${path}`];
    if (!handler) return Promise.reject(new Error(`appel inattendu : ${method} ${path}`));
    // Un gestionnaire peut renvoyer une promesse pour retenir la réponse (voir « deux temps »).
    return Promise.resolve(handler(call.body)).then((out) => {
      if (out instanceof Error) throw out;
      const status = out.status || 200;
      return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(out.body) };
    });
  });
  return calls;
}
