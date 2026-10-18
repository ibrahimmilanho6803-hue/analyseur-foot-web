import { groupOf, matchesBet, searchGroups } from "./betSearch";
import { BASELINE_RATES, BET_GROUPS, LEGACY_LABELS, REFUND_WHEN, TYPES_PARI, canonicalLabel } from "./betTypes";
import { confidenceLabel, confidenceLevel } from "./estimates";
import { formatDate, formatDay, matchKey, nameDiffers, normName } from "./format";

describe("types de paris", () => {
  test("le sélecteur propose tous les paris reconnus par le serveur, une seule fois, sauf « Autre »", () => {
    const proposes = BET_GROUPS.flatMap((g) => g.types);
    expect(new Set(proposes).size).toBe(proposes.length);
    expect([...proposes].sort()).toEqual(TYPES_PARI.filter((t) => t !== "Autre").sort());
    expect(proposes).not.toContain("Autre");
  });

  test("94 paris de plus qu'avant : 103 paris proposés, répartis en 15 familles", () => {
    const proposes = BET_GROUPS.flatMap((g) => g.types);
    expect(proposes).toHaveLength(103);
    expect(BET_GROUPS).toHaveLength(15);
    for (const g of BET_GROUPS) expect(g.types.length).toBeGreaterThan(0);
  });

  test("chaque pari a une probabilité moyenne de repli, et seulement les paris connus", () => {
    for (const [type, rate] of Object.entries(BASELINE_RATES)) {
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
      expect(TYPES_PARI).toContain(type);
    }
    expect(Object.keys(BASELINE_RATES).sort()).toEqual([...TYPES_PARI].sort());
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
});

describe("recherche d'un type de pari", () => {
  const found = (query) => searchGroups(query).flatMap((g) => g.types);

  test("une saisie vide garde tous les paris", () => {
    expect(found("")).toHaveLength(103);
    expect(found("   ")).toHaveLength(103);
    expect(searchGroups("")).toEqual(BET_GROUPS);
  });

  test("« 2,5 » et « 2.5 » désignent la même ligne, avec ou sans accents ni majuscules", () => {
    expect(found("plus de 2,5")).toEqual(found("PLUS DE 2.5"));
    expect(found("plus de 2.5")).toContain("Plus de 2.5 buts");
    expect(found("plus de 2.5")).toContain("Équipe 1 plus de 2.5 buts");
    expect(found("plus de 2.5")).not.toContain("Plus de 1.5 buts");
    expect(found("plus de 2.5")).not.toContain("Moins de 2.5 buts");
    expect(found("equipe 2")).toContain("Équipe 2 plus de 0.5 buts");
    expect(found("équipe 2")).toEqual(found("EQUIPE 2"));
  });

  test("les mots se cherchent dans n'importe quel ordre et la ligne entière se distingue de la demi-ligne", () => {
    expect(found("buts plus 1")).toContain("Plus de 1 but");
    expect(found("1.5 moins")).toContain("Moins de 1.5 buts");
    expect(found("ligne 2 plus")).toEqual([]); // un mot absent de tous les noms ne trouve rien
    const entieres = found("plus de 2 buts");
    expect(entieres).toContain("Plus de 2 buts");
    expect(entieres).not.toContain("Plus de 2.5 buts");
  });

  test("les groupes sans résultat disparaissent, les autres gardent leur titre et leur ordre", () => {
    expect(searchGroups("score")).toEqual([{ title: "Score", types: ["Score exact"] }]);
    const titres = searchGroups("nul").map((g) => g.title);
    expect(titres).toEqual(BET_GROUPS.filter((g) => g.types.some((t) => /nul/i.test(t))).map((g) => g.title));
  });

  test("matchesBet : chaque mot saisi doit être dans le nom", () => {
    expect(matchesBet("Victoire ou nul équipe 1", "nul equipe")).toBe(true);
    expect(matchesBet("Victoire ou nul équipe 1", "nul exterieur")).toBe(false);
    expect(matchesBet("Match nul", "")).toBe(true);
  });

  test("la famille d'un pari, y compris sous un ancien nom ; « Autre » n'est dans aucune famille", () => {
    expect(groupOf("Match nul")).toBe("Résultat du match");
    expect(groupOf("Plus de 2.5 buts")).toBe("Total de buts du match");
    expect(groupOf("Total buts 1.5 plus")).toBe("Total de buts du match");
    expect(groupOf("Score exact")).toBe("Score");
    expect(groupOf("Autre")).toBeNull();
    expect(groupOf("Pari imaginaire")).toBeNull();
    for (const type of TYPES_PARI.filter((t) => t !== "Autre")) expect(groupOf(type)).not.toBeNull();
  });
});

describe("dates et noms d'équipes", () => {
  // Construites avec l'heure locale : le test donne le même résultat dans tous les fuseaux horaires.
  const iso = new Date(2026, 9, 18, 19, 45).toISOString(); // dimanche 18 octobre 2026

  test("jour seul, au format jj/mm/aaaa", () => {
    expect(formatDay(iso)).toBe("18/10/2026");
    expect(formatDay(new Date(2026, 2, 5, 12, 0).toISOString())).toBe("05/03/2026");
  });

  test("jour, date, mois et heure en français", () => {
    const text = formatDate(iso);
    expect(text).toMatch(/dim/);
    expect(text).toMatch(/18/);
    expect(text).toMatch(/oct/);
    expect(text).toMatch(/19:45/);
  });

  test("date absente ou invalide : texte vide, jamais « Invalid Date »", () => {
    for (const bad of [undefined, null, "", "pas une date"]) {
      expect(formatDate(bad)).toBe("");
      expect(formatDay(bad)).toBe("");
    }
  });

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

  test("niveaux de confiance : mot en français et nombre de barres", () => {
    expect(confidenceLabel("eleve")).toBe("élevée");
    expect(confidenceLabel("moyen")).toBe("moyenne");
    expect(confidenceLabel("faible")).toBe("faible");
    expect(confidenceLabel("autre")).toBe("autre");
    expect(confidenceLabel(undefined)).toBe("—");
    expect([confidenceLevel("eleve"), confidenceLevel("moyen"), confidenceLevel("faible"), confidenceLevel("autre")]).toEqual([3, 2, 1, 0]);
  });
});
