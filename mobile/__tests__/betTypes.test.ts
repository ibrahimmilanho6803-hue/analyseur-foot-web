import { groupOf, matchesBet, searchGroups } from "../src/betSearch";
import { BET_GROUPS, TYPES_PARI } from "../src/betTypes";

describe("recherche d'un type de pari", () => {
  const found = (query: string) => searchGroups(query).flatMap((g) => g.types);

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
    const groupes = searchGroups("score");
    expect(groupes).toEqual([{ title: "Score", types: ["Score exact"] }]);
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
