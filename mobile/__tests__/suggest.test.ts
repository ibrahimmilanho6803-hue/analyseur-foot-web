import { buildIndex, canon, suggest } from "../src/suggest";
import type { Catalog } from "../src/suggest";
import { CATALOG } from "../test-support/fixtures";

const index = buildIndex(CATALOG);
const names = (q: string, opts?: { max?: number }) => suggest(index, q, opts).map((s) => s.nom);

describe("forme comparable d'un nom (mêmes règles que le serveur)", () => {
  test("accents, majuscules, ponctuation, « & », « utd » et « st »", () => {
    expect(canon("Atlético  Madrid")).toBe("atletico madrid");
    expect(canon("Man Utd")).toBe("man united");
    expect(canon("St. Pauli")).toBe("saint pauli");
    expect(canon("Brighton & Hove")).toBe("brighton and hove");
    expect(canon("Paris Saint-Germain")).toBe("paris saint germain");
    expect(canon(null)).toBe("");
    expect(canon(undefined)).toBe("");
  });
});

describe("suggestions de clubs", () => {
  test("une abréviation ou un surnom mène au club, avec l'écriture trouvée", () => {
    const [first] = suggest(index, "psg");
    expect(first).toEqual({ nom: "Paris SG", ligue: "Ligue 1", via: "PSG" });
    expect(suggest(index, "spurs")[0]).toMatchObject({ nom: "Tottenham Hotspur", via: "Spurs" });
    expect(suggest(index, "bayern")[0]).toMatchObject({ nom: "Bayern Munich", via: "Bayern" });
    expect(suggest(index, "om")[0]).toMatchObject({ nom: "Marseille", via: "OM" });
    expect(suggest(index, "inter")[0]).toMatchObject({ nom: "Inter Milan", via: "Inter" });
  });

  test("le nom officiel n'a pas d'écriture alternative à afficher", () => {
    expect(suggest(index, "arsenal")[0]).toEqual({ nom: "Arsenal", ligue: "Premier League", via: null });
    expect(suggest(index, "Marseille")[0].via).toBeNull();
  });

  test("début de nom, début de mots dans l'ordre, mot du milieu", () => {
    expect(names("manch")).toEqual(["Manchester City", "Manchester United"]);
    expect(names("man c")[0]).toBe("Manchester City");
    expect(names("man u")[0]).toBe("Manchester United");
    expect(names("city")[0]).toBe("Manchester City");
    expect(names("real m")[0]).toBe("Real Madrid");
  });

  test("sans accents ni majuscules, avec ou sans ponctuation", () => {
    expect(names("ATLÉTICO")[0]).toBe("Atlético Madrid");
    expect(names("atletico")[0]).toBe("Atlético Madrid");
    expect(names("barca")[0]).toBe("Barcelona");
    expect(names("Barça")[0]).toBe("Barcelona");
    expect(names("paris saint-germain")[0]).toBe("Paris SG");
    expect(names("  PSG  ")[0]).toBe("Paris SG");
  });

  test("un nom commun à plusieurs clubs les propose tous, sans en choisir un", () => {
    expect(names("paris").sort()).toEqual(["Paris FC", "Paris SG"]);
    expect(names("real").sort()).toEqual(["Real Betis", "Real Madrid", "Real Sociedad"]);
    expect(names("milan").sort()).toEqual(["AC Milan", "Inter Milan"]);
  });

  test("faute de frappe : proposée seulement si rien d'autre ne correspond", () => {
    expect(names("manchster city")).toEqual(["Manchester City"]);
    expect(names("bayren")).toEqual(["Bayern Munich"]); // lettres échangées
    expect(names("tottenam")).toEqual(["Tottenham Hotspur"]);
    expect(names("arsenl")).toEqual(["Arsenal"]);
  });

  test("les fautes ne s'appliquent pas aux mots courts ni à n'importe quelle première lettre", () => {
    expect(names("bvc")).toEqual([]); // 3 lettres : pas de faute tolérée, « BVB » n'est pas « BVC »
    expect(names("xrsenal")).toEqual([]);
  });

  test("rien de trouvé, saisie trop courte ou vide : aucune suggestion", () => {
    expect(names("zzzzzz")).toEqual([]);
    expect(names("a")).toEqual([]);
    expect(names("")).toEqual([]);
    expect(names("   ")).toEqual([]);
    expect(suggest(null, "arsenal")).toEqual([]);
    expect(suggest(undefined, "arsenal")).toEqual([]);
  });

  test("six suggestions au plus par défaut, réglable", () => {
    expect(names("a").length).toBe(0);
    expect(names("ar", { max: 3 }).length).toBeLessThanOrEqual(3);
    const many = buildIndex({ equipes: Array.from({ length: 20 }, (_, i) => ({ nom: `Club ${String.fromCharCode(65 + i)}`, championnat: "X", noms: [] })) });
    expect(suggest(many, "club").length).toBe(6);
    expect(suggest(many, "club", { max: 10 }).length).toBe(10);
  });

  test("les plus proches d'abord : nom identique, puis début de nom, puis (à égalité) les noms les plus courts", () => {
    const idx = buildIndex({
      equipes: [
        { nom: "Atlético Madrid", championnat: "PD", noms: [] },
        { nom: "Real Madrid", championnat: "PD", noms: [] },
        { nom: "Madrid", championnat: "PD", noms: [] },
        { nom: "Madridista Club", championnat: "PD", noms: [] },
      ],
    });
    expect(suggest(idx, "madrid").map((s) => s.nom)).toEqual(["Madrid", "Madridista Club", "Real Madrid", "Atlético Madrid"]);
  });

  test("une liste de clubs abîmée ne fait pas planter", () => {
    const abimee = { championnats: null, equipes: [null, {}, { nom: "" }, { nom: "Arsenal", noms: "pas une liste" }, { nom: "Chelsea", championnat: "PL", noms: [null, "", "The Blues"] }] };
    const idx = buildIndex(abimee as unknown as Catalog);
    expect(idx.map((t) => t.nom)).toEqual(["Arsenal", "Chelsea"]);
    expect(suggest(idx, "blues")[0]).toMatchObject({ nom: "Chelsea", via: "The Blues", ligue: "" });
    expect(buildIndex(null)).toEqual([]);
  });
});
