import { BET_GROUPS, BASELINE_RATES, BASELINE_REFUND, TYPES_PARI, canonicalLabel, isRefundable, refundRuleText } from "../src/betTypes";
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
    expect(canonicalLabel("Victoire exterieur")).toBe("Victoire extérieur");
    expect(canonicalLabel("Match nul")).toBe("Match nul");
  });

  test("102 paris du serveur, plus « Score exact » et « Autre », tous différents", () => {
    expect(TYPES_PARI).toHaveLength(104);
    expect(new Set(TYPES_PARI).size).toBe(104);
    expect(TYPES_PARI.slice(-2)).toEqual(["Score exact", "Autre"]);
  });

  test("les familles du sélecteur reprennent celles de la liste demandée", () => {
    expect(BET_GROUPS.map((g) => [g.title, g.types.length])).toEqual([
      ["Résultat du match", 6],
      ["Total de buts du match", 14],
      ["Les deux équipes marquent", 2],
      ["Total de buts de l'équipe 1 (domicile)", 10],
      ["Total de buts de l'équipe 2 (extérieur)", 10],
      ["Résultat et total de buts du match", 28],
      ["Au moins une équipe marque", 4],
      ["Résultat et total de buts d'une équipe", 28],
      ["Score", 1],
    ]);
  });

  test("les paris de chaque ligne de la liste demandée sont proposés (échantillon de chaque famille)", () => {
    const proposes = new Set(BET_GROUPS.flatMap((g) => g.types));
    for (const t of [
      "Plus de 3 buts", "Moins de 0.5 buts", "Moins de 3 buts", // total du match
      "Equipe domicile plus de 1 but", "Equipe domicile moins de 2.5 buts", "Equipe extérieur plus de 2 buts", "Equipe extérieur moins de 0.5 buts", // total d'une équipe
      "Victoire domicile + 0.5 buts plus", "Victoire domicile + moins de 3.5 buts", "Victoire/nul domicile + 3.5 buts plus", "Victoire extérieur + moins de 1.5 buts", "Victoire/nul extérieur + moins de 3.5 buts", // résultat et total
      "Au moins une équipe plus de 0.5 buts", "Au moins une équipe plus de 3.5 buts",
      "Victoire domicile + Equipe domicile 3.5 buts plus", "Victoire/nul domicile + Equipe domicile moins de 3.5 buts", "Victoire extérieur + Equipe extérieur moins de 1.5 buts", "Victoire/nul extérieur + Equipe extérieur 3.5 buts plus", // résultat et total d'une équipe
    ]) {
      expect(proposes.has(t)).toBe(true);
    }
  });

  test("chaque pari à ligne entière a la même probabilité de gagner que la demi-ligne voisine (le remboursement est à part)", () => {
    for (let n = 1; n <= 3; n++) {
      expect(BASELINE_RATES[`Plus de ${n} ${n > 1 ? "buts" : "but"}`]).toBe(BASELINE_RATES[`Plus de ${n + 0.5} buts`]);
      expect(BASELINE_RATES[`Moins de ${n} ${n > 1 ? "buts" : "but"}`]).toBe(BASELINE_RATES[`Moins de ${n - 0.5} buts`]);
    }
    for (const side of ["domicile", "extérieur"]) {
      expect(BASELINE_RATES[`Equipe ${side} plus de 1 but`]).toBe(BASELINE_RATES[`Equipe ${side} 1.5 buts plus`]);
      expect(BASELINE_RATES[`Equipe ${side} plus de 2 buts`]).toBe(BASELINE_RATES[`Equipe ${side} 2.5 buts plus`]);
      expect(BASELINE_RATES[`Equipe ${side} moins de 1 but`]).toBe(BASELINE_RATES[`Equipe ${side} moins de 0.5 buts`]);
      expect(BASELINE_RATES[`Equipe ${side} moins de 2 buts`]).toBe(BASELINE_RATES[`Equipe ${side} moins de 1.5 buts`]);
    }
  });

  test("14 paris à ligne entière, jamais « 0.5 » ni « 1.5 » : gagner + être remboursé reste une probabilité", () => {
    const refundable = TYPES_PARI.filter(isRefundable);
    expect(refundable).toHaveLength(14);
    expect(refundable.sort()).toEqual(Object.keys(BASELINE_REFUND).sort());
    for (const t of refundable) {
      expect(t).not.toMatch(/\.5/);
      expect(BASELINE_REFUND[t]).toBeGreaterThan(0);
      expect(BASELINE_RATES[t] + BASELINE_REFUND[t]).toBeLessThan(1);
    }
    expect(isRefundable("Plus de 2.5 buts")).toBe(false);
    expect(isRefundable("Score exact")).toBe(false);
    expect(isRefundable("Pari imaginaire")).toBe(false);
  });

  test("la règle de remboursement se lit sans le serveur : match entier ou équipe, au singulier comme au pluriel", () => {
    expect(refundRuleText("Plus de 2 buts")).toBe("Si le match se termine avec exactement 2 buts, la mise est remboursée (ni gagnée, ni perdue).");
    expect(refundRuleText("Moins de 1 but")).toBe("Si le match se termine avec exactement 1 but, la mise est remboursée (ni gagnée, ni perdue).");
    expect(refundRuleText("Equipe domicile plus de 1 but")).toBe("Si l'équipe 1 (à domicile) marque exactement 1 but, la mise est remboursée (ni gagnée, ni perdue).");
    expect(refundRuleText("Equipe extérieur moins de 2 buts")).toBe("Si l'équipe 2 (à l'extérieur) marque exactement 2 buts, la mise est remboursée (ni gagnée, ni perdue).");
    expect(refundRuleText("Plus de 2.5 buts")).toBeNull();
    expect(refundRuleText("Match nul")).toBeNull();
    for (const t of TYPES_PARI) expect(refundRuleText(t) !== null).toBe(isRefundable(t));
  });
});
