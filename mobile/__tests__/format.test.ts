import { BET_GROUPS, BASELINE_RATES, LEGACY_LABELS, REFUND_WHEN, TYPES_PARI, canonicalLabel } from "../src/betTypes";
import { confidenceLabel, formatDate, formatDay, matchKey, nameDiffers, normName } from "../src/format";

describe("dates en français", () => {
  // Construites avec l'heure locale : le test donne le même résultat dans tous les fuseaux horaires.
  const iso = new Date(2026, 9, 18, 19, 45).toISOString(); // dimanche 18 octobre 2026

  test("jour, date, mois et heure", () => {
    expect(formatDate(iso)).toBe("dim. 18 oct., 19:45");
    expect(formatDate(new Date(2026, 0, 3, 7, 5).toISOString())).toBe("sam. 3 janv., 07:05");
  });

  test("jour seul, au format jj/mm/aaaa", () => {
    expect(formatDay(iso)).toBe("18/10/2026");
    expect(formatDay(new Date(2026, 2, 5, 12, 0).toISOString())).toBe("05/03/2026");
  });

  test("date absente ou invalide : texte vide, jamais « Invalid Date »", () => {
    for (const bad of [undefined, null, "", "pas une date"]) {
      expect(formatDate(bad)).toBe("");
      expect(formatDay(bad)).toBe("");
    }
  });
});

describe("noms d'équipes", () => {
  test("normName ignore accents, majuscules et ponctuation", () => {
    expect(normName("Atlético  Madrid")).toBe("atletico madrid");
    expect(normName(null)).toBe("");
  });

  test("deux écritures d'un même match ont la même clé quand le serveur a reconnu les noms", () => {
    const a = { equipe1: "PSG", equipe2: "OM" };
    const b = { equipe1: "Paris Saint-Germain", equipe2: "Olympique de Marseille" };
    const reconnu = { equipe1: "Paris SG", equipe2: "Marseille" };
    expect(matchKey(a, null)).not.toBe(matchKey(b, null));
    expect(matchKey(a, reconnu)).toBe(matchKey(b, reconnu));
  });

  test("le nom reconnu est signalé seulement s'il s'éloigne de la saisie", () => {
    expect(nameDiffers("PSG", "Paris SG")).toBe(true);
    expect(nameDiffers("Arsenal", "Arsenal FC")).toBe(false);
    expect(nameDiffers("arsenal", "Arsenal")).toBe(false);
    expect(nameDiffers("", "Arsenal")).toBe(false);
  });

  test("niveaux de confiance en français", () => {
    expect(confidenceLabel("eleve")).toBe("élevée");
    expect(confidenceLabel("moyen")).toBe("moyenne");
    expect(confidenceLabel("faible")).toBe("faible");
    expect(confidenceLabel("autre")).toBe("autre");
    expect(confidenceLabel(undefined)).toBe("—");
  });
});

describe("types de paris", () => {
  test("le sélecteur propose tous les paris reconnus par le serveur, une seule fois, sauf « Autre »", () => {
    const proposes = BET_GROUPS.flatMap((g) => g.types);
    expect(new Set(proposes).size).toBe(proposes.length);
    expect([...proposes].sort()).toEqual(TYPES_PARI.filter((t) => t !== "Autre").sort());
    expect(proposes).not.toContain("Autre");
  });

  test("chaque pari a une probabilité moyenne de repli", () => {
    for (const t of TYPES_PARI) expect(BASELINE_RATES[t]).toBeGreaterThan(0);
  });

  test("les anciens libellés sont convertis", () => {
    expect(canonicalLabel("Total buts 1.5 plus")).toBe("Plus de 1.5 buts");
    expect(canonicalLabel("Victoire exterieur")).toBe("Victoire équipe 2");
    expect(canonicalLabel("Victoire domicile")).toBe("Victoire équipe 1");
    expect(canonicalLabel("Match nul")).toBe("Match nul");
    expect(canonicalLabel("Autre")).toBe("Autre");
  });

  test("chaque ancien libellé devient un pari qui existe, et aucun libellé actuel n'est un ancien nom d'un autre pari", () => {
    for (const [ancien, actuel] of Object.entries(LEGACY_LABELS)) {
      expect(TYPES_PARI).toContain(actuel);
      expect(TYPES_PARI).not.toContain(ancien);
    }
  });

  test("94 paris de plus qu'avant : 103 paris proposés, répartis en 15 familles", () => {
    const proposes = BET_GROUPS.flatMap((g) => g.types);
    expect(proposes).toHaveLength(103);
    expect(BET_GROUPS).toHaveLength(15);
    for (const g of BET_GROUPS) expect(g.types.length).toBeGreaterThan(0);
  });

  test("les lignes entières (remboursables) sont des paris proposés, avec le texte du remboursement", () => {
    const proposes = BET_GROUPS.flatMap((g) => g.types);
    expect(Object.keys(REFUND_WHEN)).toHaveLength(14);
    for (const [type, quand] of Object.entries(REFUND_WHEN)) {
      expect(proposes).toContain(type);
      expect(type).toMatch(/ (1 but|2 buts|3 buts)$/); // ligne entière, jamais une demi-ligne
      expect(quand).toMatch(/exactement [123] buts?/);
    }
    for (const type of proposes.filter((t) => /(plus|moins) de \d (but|buts)$/.test(t))) expect(REFUND_WHEN[type]).toBeDefined();
  });

  test("les probabilités moyennes sont des probabilités", () => {
    for (const [type, rate] of Object.entries(BASELINE_RATES)) {
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
      expect(TYPES_PARI).toContain(type);
    }
    expect(Object.keys(BASELINE_RATES).sort()).toEqual([...TYPES_PARI].sort());
  });
});
