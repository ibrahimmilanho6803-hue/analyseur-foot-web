import { asCross, awaitsReview, crossLeagueNote, estimateProb, estimatesForChunk, fairOdds, fromTopMatch, mergeEstimates, survival, toEstimate } from "../src/estimates";
import type { Estimate } from "../src/types";
import { CROSS_MESSAGE, CROSS_WEAK_MESSAGE, REFUND_RULE, cross, cupLeg, okLeg, quick, refundLeg, topEntry } from "../test-support/fixtures";

describe("estimation d'une sélection", () => {
  const sel = { id: "a", typePari: "Plus de 1.5 buts" };
  const hist = (won: number, lost: number, label = "Plus de 1.5 buts") => [
    ...Array.from({ length: won }, () => ({ typePari: label, statut: "gagne" as const })),
    ...Array.from({ length: lost }, () => ({ typePari: label, statut: "perdu" as const })),
  ];

  test("l'analyse du serveur passe avant tout le reste", () => {
    const r = estimateProb(hist(10, 0), sel, { a: { p: 0.62 } });
    expect(r.p).toBe(0.62);
    expect(r.source).toBe("analyse");
  });

  test("sans analyse, l'historique est ramené vers la moyenne : 3 paris gagnés ne prouvent rien", () => {
    const r = estimateProb(hist(3, 0), sel, {});
    expect(r.source).toBe("historique");
    expect(r.p).toBeGreaterThan(0.75);
    expect(r.p).toBeLessThan(0.9);
  });

  test("moins de 3 paris clôturés : moyenne générale du type de pari", () => {
    const r = estimateProb(hist(2, 0), sel, {});
    expect(r.source).toBe("general");
    expect(r.p).toBe(0.75);
  });

  test("les paris en attente ne comptent pas dans l'historique", () => {
    const enAttente = Array.from({ length: 5 }, () => ({ typePari: "Plus de 1.5 buts", statut: "en_attente" as const }));
    expect(estimateProb(enAttente, sel, {}).source).toBe("general");
  });

  test("une analyse impossible (p nul) ne fournit jamais de probabilité : retour à la moyenne", () => {
    const r = estimateProb([], sel, { a: { p: null, message: "Équipe introuvable" } });
    expect(r.source).toBe("general");
  });

  test("les anciens libellés de l'historique comptent toujours", () => {
    const r = estimateProb(hist(5, 0, "Total buts 1.5 plus"), sel, {});
    expect(r.source).toBe("historique");
    expect(r.n).toBe(5);
  });

  test("un type de pari inconnu retombe sur 40 %", () => {
    expect(estimateProb([], { id: "z", typePari: "Pari imaginaire" }, {}).p).toBe(0.4);
  });
});

describe("lecture des réponses du serveur", () => {
  test("une analyse valide devient une probabilité bornée", () => {
    expect(toEstimate(okLeg({ probabilite: 62.3 })).p).toBeCloseTo(0.623, 5);
    expect(toEstimate(okLeg({ probabilite: 100 })).p).toBe(0.99);
    expect(toEstimate(okLeg({ probabilite: 0 })).p).toBe(0.01);
  });

  test("sans analyse chiffrée : p vaut null, avec le message et les suggestions du serveur", () => {
    const e = toEstimate({ etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable.", suggestions: { equipe1: ["Arsenal", "Aston Villa"], equipe2: [] } });
    expect(e.p).toBeNull();
    expect(e.message).toContain("Équipe introuvable.");
    expect(e.message).toContain("Arsenal, Aston Villa");
  });

  test("une réponse « ok » sans nombre n'est pas une analyse", () => {
    expect(toEstimate({ etat: "ok", probabilite: null }).p).toBeNull();
    expect(toEstimate({ etat: "erreur" }).message).toMatch(/Analyse impossible/);
  });

  test("réponse absente : message clair, pas de probabilité", () => {
    expect(toEstimate(undefined).p).toBeNull();
    expect(toEstimate(null).message).toMatch(/Pas de réponse/);
  });

  test("un match du Top Matchs garde ses détails", () => {
    const e = fromTopMatch(topEntry(0));
    expect(e.p).toBeCloseTo(0.784, 5);
    expect(e.vigilance).toBe("Rotation possible");
    expect(e.statsEquipe1).toEqual({ forme: "VVNVV" });
    expect(fromTopMatch({} as never).p).toBeNull();
    expect(fromTopMatch(null).p).toBeNull();
  });

  test("les réponses sont rattachées aux sélections dans l'ordre, et les relectures IA manquantes sont comptées", () => {
    const chunk = [{ id: "x" }, { id: "y" }, { id: "z" }];
    const { next, iaDown } = estimatesForChunk(chunk, [okLeg(), okLeg({ ia: { statut: "indisponible" } }), undefined]);
    expect(next.x.p).toBeCloseTo(0.623, 5);
    expect(iaDown).toBe(1);
    expect(next.z.p).toBeNull();
  });

  test("une réponse qui n'est pas une liste est traitée comme absente", () => {
    const { next, iaDown } = estimatesForChunk([{ id: "x" }], undefined);
    expect(next.x.p).toBeNull();
    expect(iaDown).toBe(0);
  });
});

describe("noms reconnus", () => {
  test("lecture des réponses : noms, championnat et date sont conservés", () => {
    const e = toEstimate(okLeg({ equipe1: "Paris SG", equipe2: "Marseille", competition: "Ligue 1", date: "2026-10-18T19:45:00.000Z" }));
    expect(e).toMatchObject({ equipe1: "Paris SG", equipe2: "Marseille", competition: "Ligue 1", date: "2026-10-18T19:45:00.000Z" });
    expect(fromTopMatch(topEntry(0))).toMatchObject({ equipe1: "Arsenal", equipe2: "Chelsea", competition: "Premier League" });
  });
});

describe("fusion des estimations", () => {
  test("une probabilité n'est jamais remplacée par un échec, mais un échec peut remplacer un échec", () => {
    const prev: Record<string, Estimate> = { a: { p: 0.6 }, b: { p: null, message: "ancien" } };
    const out = mergeEstimates(prev, { a: { p: null, message: "échec" }, b: { p: null, message: "nouveau" }, c: { p: 0.5 }, d: { p: null, message: "x" } });
    expect(out.a.p).toBe(0.6);
    expect(out.b.message).toBe("nouveau");
    expect(out.c.p).toBe(0.5);
    expect(out.d.message).toBe("x");
    expect(prev.a.p).toBe(0.6); // l'original n'est pas modifié
  });

  test("une réponse attend la relecture de l'IA seulement si elle est valide et sans IA demandée", () => {
    expect(awaitsReview(quick())).toBe(true);
    expect(awaitsReview(okLeg())).toBe(false);
    expect(awaitsReview(quick({ ia: { statut: "desactivee" } }))).toBe(false);
    expect(awaitsReview(quick({ ia: { statut: "non_applicable" } }))).toBe(false);
    expect(awaitsReview({ etat: "equipe_inconnue", ia: { statut: "non_demandee" } })).toBe(false);
    expect(awaitsReview(undefined)).toBe(false);
  });
});

describe("clubs de championnats différents", () => {
  test("la comparaison du serveur est gardée avec l'estimation (analyse, Auto et Top Matchs)", () => {
    expect(toEstimate(cupLeg()).crossLeague).toEqual(cross());
    expect(fromTopMatch(topEntry(0, { comparaisonEntreChampionnats: cross() })).crossLeague).toEqual(cross());
    expect(toEstimate(cupLeg()).p).toBeCloseTo(0.623, 5); // la probabilité, elle, ne change pas
  });

  test("deux clubs du même championnat, ou serveur plus ancien : rien à signaler", () => {
    expect(toEstimate(okLeg()).crossLeague).toBeUndefined();
    expect(toEstimate(okLeg({ comparaisonEntreChampionnats: null })).crossLeague).toBeUndefined();
    expect(fromTopMatch(topEntry(0)).crossLeague).toBeUndefined();
    expect(fromTopMatch(topEntry(0, { comparaisonEntreChampionnats: null })).crossLeague).toBeUndefined();
  });

  test("une valeur qui n'est pas un objet est ignorée", () => {
    expect(toEstimate(okLeg({ comparaisonEntreChampionnats: "oui" as never })).crossLeague).toBeUndefined();
    expect(asCross([cross()])).toBeUndefined();
    expect(asCross(42)).toBeUndefined();
    expect(asCross(cross())).toEqual(cross());
  });

  test("l'avertissement affiché est celui du serveur, ou à défaut une phrase générale", () => {
    expect(crossLeagueNote(cross())).toBe(CROSS_MESSAGE);
    expect(crossLeagueNote(cross({ niveauDesChampionnatsMesure: false, message: CROSS_WEAK_MESSAGE }))).toBe(CROSS_WEAK_MESSAGE);
    expect(crossLeagueNote({ championnat1: "Premier League" })).toMatch(/ne jouent pas dans le même championnat/);
    expect(crossLeagueNote({ message: "   " })).toMatch(/estimation moins précise/);
    expect(crossLeagueNote(undefined)).toBeNull();
    expect(crossLeagueNote(null)).toBeNull();
  });

  test("une analyse impossible n'emporte aucune comparaison", () => {
    expect(toEstimate({ etat: "equipe_inconnue", probabilite: null, message: "Équipe introuvable.", comparaisonEntreChampionnats: cross() }).crossLeague).toBeUndefined();
  });
});

describe("paris à ligne entière (remboursés quand le total tombe pile sur la ligne)", () => {
  test("la réponse du serveur garde la probabilité de gagner, celle du remboursement et la règle", () => {
    const e = toEstimate(refundLeg());
    expect(e.p).toBeCloseTo(0.494, 5);
    expect(e.push).toBeCloseTo(0.258, 5);
    expect(e.refundRule).toBe(REFUND_RULE);
  });

  test("un pari ordinaire, ou un serveur plus ancien : aucun remboursement", () => {
    expect(toEstimate(okLeg()).push).toBe(0);
    expect(toEstimate(okLeg()).refundRule).toBeUndefined();
    expect(toEstimate(okLeg({ probabiliteRemboursement: null, regleRemboursement: "  " })).push).toBe(0);
    expect(toEstimate(okLeg({ regleRemboursement: "  " })).refundRule).toBeUndefined();
  });

  test("une valeur absurde du serveur est ramenée dans les bornes", () => {
    expect(toEstimate(refundLeg({ probabiliteRemboursement: -5 })).push).toBe(0);
    expect(toEstimate(refundLeg({ probabiliteRemboursement: 250 })).push).toBe(0.99);
    expect(toEstimate(refundLeg({ probabiliteRemboursement: "beaucoup" as never })).push).toBe(0);
  });

  test("chance de ne rien perdre et cote équitable : le remboursement fait monter l'une et baisser l'autre", () => {
    const e = { p: 0.494, push: 0.258 };
    expect(survival(e)).toBeCloseTo(0.752, 5);
    expect(fairOdds(e)).toBeCloseTo(1.502, 3); // (1 − 0,258) ÷ 0,494 : la cote d'un pari sans remboursement serait 2,02
    expect(survival({ p: 0.62 })).toBe(0.62);
    expect(fairOdds({ p: 0.62 })).toBeCloseTo(1 / 0.62, 10);
    expect(survival({ p: 0.98, push: 0.05 })).toBe(0.995); // jamais une certitude
  });

  test("sans analyse : moyenne générale de gagner et de remboursement ; l'historique n'est pas utilisé", () => {
    const wins = Array.from({ length: 6 }, () => ({ typePari: "Plus de 2 buts", statut: "gagne" as const }));
    const r = estimateProb(wins, { id: "r", typePari: "Plus de 2 buts" }, {});
    expect(r).toMatchObject({ p: 0.49, source: "general", push: 0.26 });
  });

  test("avec l'analyse du serveur : la probabilité de gagner et le remboursement viennent d'elle", () => {
    const r = estimateProb([], { id: "r", typePari: "Plus de 2 buts" }, { r: toEstimate(refundLeg()) });
    expect(r.source).toBe("analyse");
    expect(r.p).toBeCloseTo(0.494, 5);
    expect(r.push).toBeCloseTo(0.258, 5);
    expect(r.refundRule).toBe(REFUND_RULE);
  });

  test("les paris ordinaires n'ont jamais de remboursement", () => {
    expect(estimateProb([], { id: "a", typePari: "Plus de 2.5 buts" }, {}).push).toBe(0);
    expect(estimateProb([], { id: "a", typePari: "Plus de 2.5 buts" }, { a: toEstimate(okLeg()) }).push).toBe(0);
  });

  test("un pari remboursé n'est ni gagné ni perdu : il ne compte pas dans l'historique d'un type de pari", () => {
    const sel = { id: "a", typePari: "Plus de 1.5 buts" };
    const mix = [
      ...Array.from({ length: 2 }, () => ({ typePari: "Plus de 1.5 buts", statut: "gagne" as const })),
      ...Array.from({ length: 6 }, () => ({ typePari: "Plus de 1.5 buts", statut: "rembourse" as const })),
    ];
    expect(estimateProb(mix, sel, {}).source).toBe("general"); // 2 paris réglés seulement
    expect(estimateProb([...mix, { typePari: "Plus de 1.5 buts", statut: "perdu" as const }], sel, {})).toMatchObject({ source: "historique", n: 3 });
  });
});
