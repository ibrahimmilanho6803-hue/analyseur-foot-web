import { useCallback, useMemo, useState } from "react";
import { callApi } from "../api";
import { TYPES_PARI } from "../betTypes";
import { awaitsReview, estimateProb, estimatesForChunk, fromTopMatch, mergeEstimates, toEstimate } from "../estimates";
import { MAX_LEGS_PER_CALL, matchKey, todayISO, uid } from "../format";
import type {
  AnalyzeResponse,
  ApiLeg,
  AutoCouponResponse,
  Estimate,
  GenReport,
  MatchToGenerate,
  ProbEstimate,
  Pronostic,
  Selection,
  TabKey,
  TopMatch,
  TopMatchesResponse,
  TopMeta,
} from "../types";
import { useHistory } from "./useHistory";
import { useTeamCatalog } from "./useTeamCatalog";

export interface MatchForm {
  equipe1: string;
  equipe2: string;
  typePari: string;
  matchDate: string;
}

export interface GenForm {
  equipe1: string;
  equipe2: string;
  matchDate: string;
}

/** Une sélection du coupon avec la probabilité retenue (analyse du serveur, historique ou moyenne générale). */
export type Evaluation = ProbEstimate & { sel: Selection; failed: boolean; message?: string };

export interface CouponAnalysis {
  evals: Evaluation[];
  combined: number;
  weakest: Evaluation;
  combinedWithout: number | null;
  /** Sélections sans analyse chiffrée du serveur : le pourcentage affiché n'est alors qu'indicatif. */
  pending: number;
  sameMatch: boolean;
}

const FIVE_MINUTES = 5 * 60000;

// Tout l'état de l'application et ses actions : l'équivalent du composant principal du site, sans l'affichage.
export function useAnalyseur() {
  const { pronostics, persist, loading } = useHistory();
  const catalog = useTeamCatalog();
  const [draft, setDraft] = useState<Selection[]>([]);
  const [form, setForm] = useState<MatchForm>(() => ({ equipe1: "", equipe2: "", typePari: TYPES_PARI[0], matchDate: todayISO() }));
  const [aiEstimates, setAiEstimates] = useState<Record<string, Estimate>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiPhase, setAiPhase] = useState<"modele" | "ia" | null>(null); // « modele » : calcul du modèle ; « ia » : modèle affiché, relecture par l'IA en cours
  const [matchesToGenerate, setMatchesToGenerate] = useState<MatchToGenerate[]>([]);
  const [genForm, setGenForm] = useState<GenForm>(() => ({ equipe1: "", equipe2: "", matchDate: todayISO() }));
  const [genLoading, setGenLoading] = useState(false);
  const [genReport, setGenReport] = useState<GenReport | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("build");
  const [topMatches, setTopMatches] = useState<TopMatch[]>([]);
  const [topMeta, setTopMeta] = useState<TopMeta | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [topAt, setTopAt] = useState(0);

  const stats = useMemo(() => {
    const closed = pronostics.filter((p) => p.statut !== "en_attente");
    const wins = closed.filter((p) => p.statut === "gagne").length;
    return { rate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : null, closedCount: closed.length, pending: pronostics.length - closed.length };
  }, [pronostics]);

  // Historique regroupé par coupon, le plus récent d'abord.
  const coupons = useMemo(() => {
    const map: Record<string, Pronostic[]> = {};
    pronostics.forEach((p) => {
      const key = p.couponId || p.id;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return Object.values(map).sort((a, b) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime());
  }, [pronostics]);

  const analysis = useMemo<CouponAnalysis | null>(() => {
    if (draft.length === 0) return null;
    const evals: Evaluation[] = draft.map((sel) => {
      const est = estimateProb(pronostics, sel, aiEstimates);
      const ai = aiEstimates[sel.id];
      const failed = Boolean(ai) && ai.p === null;
      return { sel, ...est, failed, message: failed ? ai.message : undefined };
    });
    const combined = evals.reduce((acc, e) => acc * e.p, 1);
    const weakest = [...evals].sort((a, b) => a.p - b.p)[0];
    const withoutWeakest = evals.filter((e) => e.sel.id !== weakest.sel.id);
    const combinedWithout = withoutWeakest.length > 0 ? withoutWeakest.reduce((acc, e) => acc * e.p, 1) : null;
    const pending = evals.filter((e) => e.source !== "analyse").length;
    const keys = draft.map((sel) => matchKey(sel, aiEstimates[sel.id]));
    const sameMatch = new Set(keys).size < keys.length;
    return { evals, combined, weakest, combinedWithout, pending, sameMatch };
  }, [draft, pronostics, aiEstimates]);

  const addToDraft = () => {
    if (!form.equipe1.trim() || !form.equipe2.trim()) return;
    setDraft((d) => [...d, { id: uid(), equipe1: form.equipe1.trim(), equipe2: form.equipe2.trim(), typePari: form.typePari, matchDate: form.matchDate }]);
    setForm((f) => ({ ...f, equipe1: "", equipe2: "" }));
  };

  const removeFromDraft = (id: string) => setDraft((d) => d.filter((x) => x.id !== id));

  // Analyse du coupon par le serveur, en deux temps : le modèle statistique répond en une fraction de seconde et s'affiche tout de
  // suite ; la relecture par l'IA (quelques secondes) vient ensuite l'ajuster de quelques points. Si elle échoue, le résultat du
  // modèle reste affiché. Aucune probabilité n'est inventée par l'application.
  const analyzeWithAI = async () => {
    if (draft.length === 0 || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiNotice(null);
    setAiPhase("modele");
    const legsOf = (list: Selection[]) => list.map((s) => ({ equipe1: s.equipe1, equipe2: s.equipe2, typePari: s.typePari }));
    const chunksOf = (list: Selection[]) => {
      const out: Selection[][] = [];
      for (let i = 0; i < list.length; i += MAX_LEGS_PER_CALL) out.push(list.slice(i, i + MAX_LEGS_PER_CALL));
      return out;
    };
    let unavailable = 0;
    let reviewError: Error | null = null;
    try {
      const toReview: Selection[] = [];
      for (const chunk of chunksOf(draft)) {
        const res = await callApi<AnalyzeResponse>("/api/analyze", { method: "POST", timeoutMs: 100000, body: { ia: false, legs: legsOf(chunk) } });
        const list: ApiLeg[] = Array.isArray(res && res.legs) ? (res.legs as ApiLeg[]) : [];
        const { next, iaDown } = estimatesForChunk(chunk, list);
        unavailable += iaDown;
        setAiEstimates((prev) => ({ ...prev, ...next }));
        chunk.forEach((sel, k) => {
          if (awaitsReview(list[k])) toReview.push(sel);
        });
      }
      // Un serveur qui répond déjà avec l'IA (ancienne version) n'a rien à relancer.
      if (toReview.length > 0) {
        setAiPhase("ia");
        for (const chunk of chunksOf(toReview)) {
          try {
            const res = await callApi<AnalyzeResponse>("/api/analyze", { method: "POST", timeoutMs: 100000, body: { legs: legsOf(chunk) } });
            const { next, iaDown } = estimatesForChunk(chunk, res && res.legs);
            unavailable += iaDown;
            setAiEstimates((prev) => mergeEstimates(prev, next));
          } catch (e) {
            reviewError = e as Error;
          }
        }
      }
      if (reviewError) setAiNotice("La relecture par l'IA n'a pas pu être faite (" + reviewError.message + ") : le modèle statistique répond seul.");
      else if (unavailable > 0) setAiNotice("La relecture par l'IA était indisponible pour " + (unavailable > 1 ? "certaines sélections" : "une sélection") + " : le modèle statistique répond seul.");
    } catch (e) {
      setAiError("Analyse impossible : " + (e as Error).message);
    } finally {
      setAiLoading(false);
      setAiPhase(null);
    }
  };

  const fetchTopMatches = async () => {
    if (topLoading) return;
    setTopLoading(true);
    setTopError(null);
    try {
      const data = await callApi<TopMatchesResponse>("/api/top-matches");
      setTopMatches(Array.isArray(data.topMatches) ? data.topMatches : []);
      setTopMeta({
        coteTotale: data.coteTotale,
        probabiliteCombinee: data.probabiliteCombinee,
        avertissement: data.avertissement,
        avertissementDonnees: data.avertissementDonnees,
        message: data.message,
        ia: data.ia,
        complet: data.complet,
        perime: data.perime,
        fenetreHeures: data.fenetreHeures,
        nbChampionnats: data.donnees && Array.isArray(data.donnees.championnatsPrets) ? data.donnees.championnatsPrets.length : null,
        nbCoupes: data.donnees && Array.isArray(data.donnees.coupesPretes) ? data.donnees.coupesPretes.length : 0,
      });
      setTopAt(Date.now());
    } catch (e) {
      setTopMatches((prev) => prev.filter((m) => Date.parse(m.date || "") > Date.now())); // on ne garde pas un match déjà commencé
      setTopError("Impossible de charger les matchs : " + (e as Error).message);
    } finally {
      setTopLoading(false);
    }
  };

  const isInDraft = (match: TopMatch) => draft.some((d) => d.equipe1 === match.homeTeam && d.equipe2 === match.awayTeam && d.typePari === match.meilleurPari);

  const addTopMatchToDraft = (match: TopMatch) => {
    if (isInDraft(match)) return;
    const newId = uid();
    setDraft((d) => [...d, { id: newId, equipe1: match.homeTeam, equipe2: match.awayTeam, typePari: match.meilleurPari, matchDate: (match.date || "").slice(0, 10) || todayISO() }]);
    setAiEstimates((prev) => ({ ...prev, [newId]: fromTopMatch(match) }));
  };

  // Coupon automatique : le serveur choisit le pari le plus probable de chaque match saisi.
  const generateAutoCoupon = async () => {
    if (matchesToGenerate.length === 0 || genLoading) return;
    setGenLoading(true);
    setGenReport(null);
    try {
      const batch = matchesToGenerate.slice(0, MAX_LEGS_PER_CALL);
      const res = await callApi<AutoCouponResponse>("/api/auto-coupon", {
        method: "POST",
        timeoutMs: 100000,
        body: { matches: batch.map((m) => ({ equipe1: m.equipe1, equipe2: m.equipe2 })) },
      });
      const results: ApiLeg[] = Array.isArray(res && res.resultats) ? (res.resultats as ApiLeg[]) : [];
      const newDraft: Selection[] = [];
      const newEstimates: Record<string, Estimate> = {};
      const problems: string[] = [];
      const done = new Set<string>();
      batch.forEach((m, i) => {
        const r = results.find((x) => x && x.index === i);
        if (r && r.etat === "ok" && typeof r.probabilite === "number" && r.typePari) {
          const id = uid();
          newDraft.push({ id, equipe1: r.equipe1 || m.equipe1, equipe2: r.equipe2 || m.equipe2, typePari: r.typePari, matchDate: (r.date || "").slice(0, 10) || m.matchDate });
          newEstimates[id] = toEstimate(r);
          done.add(m.id);
        } else {
          problems.push(`${m.equipe1} vs ${m.equipe2} : ${toEstimate(r).message}`);
        }
      });
      if (newDraft.length > 0) {
        setDraft((d) => [...d, ...newDraft]);
        setAiEstimates((prev) => ({ ...prev, ...newEstimates }));
        setMatchesToGenerate((list) => list.filter((m) => !done.has(m.id)));
      }
      if (problems.length === 0) setActiveTab("build");
      else setGenReport({ added: newDraft.length, problems });
    } catch (e) {
      setGenReport({ added: 0, problems: [(e as Error).message] });
    } finally {
      setGenLoading(false);
    }
  };

  const addMatchToGenerate = () => {
    if (!genForm.equipe1.trim() || !genForm.equipe2.trim()) return;
    if (matchesToGenerate.length >= MAX_LEGS_PER_CALL) {
      setGenReport({ added: 0, problems: [`${MAX_LEGS_PER_CALL} matchs au maximum par génération.`] });
      return;
    }
    setGenReport(null);
    setMatchesToGenerate((list) => [...list, { id: uid(), equipe1: genForm.equipe1.trim(), equipe2: genForm.equipe2.trim(), matchDate: genForm.matchDate }]);
    setGenForm((f) => ({ ...f, equipe1: "", equipe2: "" }));
  };

  const removeFromGenerate = (id: string) => setMatchesToGenerate((list) => list.filter((x) => x.id !== id));

  const saveCoupon = async () => {
    if (draft.length === 0) return;
    const couponId = uid();
    // L'historique garde les noms reconnus par le serveur quand il y a eu une analyse (« Paris SG » plutôt que « PSG »).
    const entries: Pronostic[] = draft.map((s) => ({
      id: uid(),
      couponId,
      equipe1: (aiEstimates[s.id] && aiEstimates[s.id].equipe1) || s.equipe1,
      equipe2: (aiEstimates[s.id] && aiEstimates[s.id].equipe2) || s.equipe2,
      typePari: s.typePari,
      cote: null,
      matchDate: s.matchDate || todayISO(),
      statut: "en_attente",
      date: new Date().toISOString(),
    }));
    // Le coupon se vide tout de suite (un second appui ne l'enregistrerait pas deux fois), puis l'écriture sur le téléphone suit.
    setDraft([]);
    setAiEstimates({});
    setAiError(null);
    setAiNotice(null);
    await persist([...entries, ...pronostics]);
  };

  const setSelStatut = async (id: string, statut: Pronostic["statut"]) => {
    await persist(pronostics.map((p) => (p.id === id ? { ...p, statut } : p)));
  };
  const removeSel = async (id: string) => {
    await persist(pronostics.filter((p) => p.id !== id));
  };

  const openTab = (key: TabKey) => {
    setActiveTab(key);
    if (key === "top" && !topLoading && Date.now() - topAt > FIVE_MINUTES) void fetchTopMatches();
  };

  const toggleDetails = useCallback(() => setShowDetails((v) => !v), []);

  return {
    loading,
    catalog,
    pronostics,
    stats,
    coupons,
    draft,
    form,
    setForm,
    aiEstimates,
    aiLoading,
    aiError,
    aiNotice,
    aiPhase,
    analysis,
    matchesToGenerate,
    genForm,
    setGenForm,
    genLoading,
    genReport,
    showDetails,
    toggleDetails,
    activeTab,
    openTab,
    setActiveTab,
    topMatches,
    topMeta,
    topLoading,
    topError,
    topAt,
    addToDraft,
    removeFromDraft,
    analyzeWithAI,
    fetchTopMatches,
    isInDraft,
    addTopMatchToDraft,
    generateAutoCoupon,
    addMatchToGenerate,
    removeFromGenerate,
    saveCoupon,
    setSelStatut,
    removeSel,
  };
}

export type Controller = ReturnType<typeof useAnalyseur>;
