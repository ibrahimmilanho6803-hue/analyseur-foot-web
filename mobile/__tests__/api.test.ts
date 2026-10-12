import { callApi } from "../src/api";
import { API_BASE } from "../src/config";
import { installFetch } from "../test-support/fakeServer";

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe("appel du serveur", () => {
  test("l'adresse du serveur est celle de production par défaut", () => {
    expect(API_BASE).toBe("https://analyseur-foot-api.onrender.com");
  });

  test("réponse valide : le contenu JSON est renvoyé", async () => {
    const calls = installFetch({ "GET /api/x": () => ({ body: { ok: 1 } }) });
    await expect(callApi("/api/x")).resolves.toEqual({ ok: 1 });
    expect(calls[0].url).toBe("https://analyseur-foot-api.onrender.com/api/x");
  });

  test("envoi d'un corps JSON en POST", async () => {
    const calls = installFetch({ "POST /api/x": () => ({ body: {} }) });
    await callApi("/api/x", { method: "POST", body: { legs: [] } });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ legs: [] });
    const init = (globalThis as any).fetch.mock.calls[0][1];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  test("erreur du serveur : on affiche son message", async () => {
    installFetch({ "GET /api/x": () => ({ status: 429, body: { error: "Trop de demandes : réessayez dans 12 s." } }) });
    await expect(callApi("/api/x")).rejects.toMatchObject({ message: "Trop de demandes : réessayez dans 12 s.", status: 429 });
  });

  test("serveur injoignable : message lisible", async () => {
    installFetch({ "GET /api/x": () => new TypeError("Network request failed") });
    await expect(callApi("/api/x")).rejects.toThrow(/Impossible de joindre le serveur/);
  });

  test("délai dépassé : message lisible", async () => {
    jest.useFakeTimers();
    try {
      (globalThis as any).fetch = jest.fn(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
          }),
      );
      const request = callApi("/api/x", { timeoutMs: 1000 });
      const attendu = expect(request).rejects.toThrow(/trop de temps/);
      jest.advanceTimersByTime(1001);
      await attendu;
    } finally {
      jest.useRealTimers();
    }
  });

  test("réponse sans JSON : l'état HTTP est indiqué", async () => {
    (globalThis as any).fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error("pas de json")) }));
    await expect(callApi("/api/x")).rejects.toThrow("Erreur 502");
  });
});
