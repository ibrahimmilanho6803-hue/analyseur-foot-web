import { useState, useEffect, useMemo, useRef } from "react";
import { callApi } from "./api";
import { TYPES_PARI } from "./betTypes";
import { awaitsReview, estimateProb, estimatesForChunk, fromTopMatch, mergeEstimates, targetShortfall, toEstimate } from "./estimates";
import { matchKey, todayISO, uid } from "./format";
import { useTeamCatalog } from "./useTeamCatalog";

const MAX_LEGS_PER_CALL = 12; // limite du serveur pour une requête

// Historique des coupons : gardé sur l'appareil (localStorage). Sans stockage disponible, l'application fonctionne quand même.
function useStore() {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    try { const saved = localStorage.getItem("coupon-pronostics"); if (saved) setPronostics(JSON.parse(saved)); } catch (e) {}
    setLoading(false);
  }, []);
  const persist = async (next) => { setPronostics(next); try { localStorage.setItem("coupon-pronostics", JSON.stringify(next)); } catch (e) {} };
  return { pronostics, persist, loading };
}

// Tout l'état et toutes les actions du site : les écrans ne font que les afficher.
export function useAnalyseur() {
  const { pronostics, persist, loading } = useStore();
  const catalog = useTeamCatalog();
  const [draft, setDraft] = useState([]);
  const [form, setForm] = useState({ equipe1: "", equipe2: "", typePari: TYPES_PARI[0], cote: "", matchDate: todayISO() });
  const [aiEstimates, setAiEstimates] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiNotice, setAiNotice] = useState(null);
  const [aiPhase, setAiPhase] = useState(null); // "modele" : calcul du modèle ; "ia" : modèle affiché, relecture par l'IA en cours
  const [matchesToGenerate, setMatchesToGenerate] = useState([]);
  const [genForm, setGenForm] = useState({ equipe1: "", equipe2: "", matchDate: todayISO() });
  const [genLoading, setGenLoading] = useState(false);
  const [genReport, setGenReport] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("build");
  const [topMatches, setTopMatches] = useState([]);
  const [topMeta, setTopMeta] = useState(null);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState(null);
  const [topAt, setTopAt] = useState(0);
  // Pronostics ajoutés au coupon par la dernière génération « Auto » qui n'a pas atteint la cote visée : la génération suivante les remplace.
  const unreachedAuto = useRef([]);

  const stats = useMemo(() => {
    const closed = pronostics.filter((p) => p.statut !== "en_attente");
    const wins = closed.filter((p) => p.statut === "gagne").length;
    return { rate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : null, closedCount: closed.length, pending: pronostics.length - closed.length };
  }, [pronostics]);

  const coupons = useMemo(() => {
    const map = {};
    pronostics.forEach((p) => { const key = p.couponId || p.id; if (!map[key]) map[key] = []; map[key].push(p); });
    return Object.values(map).sort((a, b) => new Date(b[0].date) - new Date(a[0].date));
  }, [pronostics]);

  const analysis = useMemo(() => {
    if (draft.length === 0) return null;
    const evals = draft.map((sel) => {
      const est = estimateProb(pronostics, sel, aiEstimates);
      const ai = aiEstimates[sel.id];
      const failed = Boolean(ai) && ai.p === null;
      return { sel, ...est, failed, message: failed ? ai.message : undefined };
    });
    const combined = evals.reduce((acc, e) => acc * e.p, 1);
    const weakest = [...evals].sort((a, b) => a.p - b.p)[0];
    const withoutWeakest = evals.filter((e) => e.sel.id !== weakest.sel.id);
    const combinedWithout = withoutWeakest.length > 0 ? withoutWeakest.reduce((acc, e) => acc * e.p, 1) : null;
    // pending : sélections sans analyse chiffrée du serveur (le pourcentage affiché n'est alors qu'indicatif).
    const pending = evals.filter((e) => e.source !== "analyse").length;
    const keys = draft.map((sel) => matchKey(sel, aiEstimates[sel.id]));
    const sameMatch = new Set(keys).size < keys.length;
    // Sélections dont les deux clubs viennent de championnats différents : leur estimation est moins précise, et le total aussi.
    const crossCount = evals.filter((e) => !e.failed && e.source === "analyse" && aiEstimates[e.sel.id] && aiEstimates[e.sel.id].crossLeague).length;
    return { evals, combined, weakest, combinedWithout, pending, sameMatch, crossCount };
  }, [draft, pronostics, aiEstimates]);

  const addToDraft = () => {
    if (!form.equipe1.trim() || !form.equipe2.trim()) return;
    setDraft([...draft, { id: uid(), ...form, equipe1: form.equipe1.trim(), equipe2: form.equipe2.trim() }]);
    setForm({ ...form, equipe1: "", equipe2: "", cote: "" });
  };

  const removeFromDraft = (id) => setDraft((d) => d.filter((x) => x.id !== id));

  // Analyse du coupon par le serveur, en deux temps : le modèle statistique répond en une fraction de seconde et s'affiche tout de
  // suite ; la relecture par l'IA (quelques secondes) vient ensuite l'ajuster de quelques points. Si elle échoue, le résultat du
  // modèle reste affiché. Aucune probabilité n'est inventée côté site.
  const analyzeWithAI = async () => {
    if (draft.length === 0 || aiLoading) return;
    setAiLoading(true); setAiError(null); setAiNotice(null); setAiPhase("modele");
    const legsOf = (list) => list.map((s) => ({ equipe1: s.equipe1, equipe2: s.equipe2, typePari: s.typePari }));
    const chunksOf = (list) => {
      const out = [];
      for (let i = 0; i < list.length; i += MAX_LEGS_PER_CALL) out.push(list.slice(i, i + MAX_LEGS_PER_CALL));
      return out;
    };
    let unavailable = 0;
    let reviewError = null;
    try {
      const toReview = [];
      for (const chunk of chunksOf(draft)) {
        const res = await callApi("/api/analyze", { method: "POST", timeoutMs: 100000, body: { ia: false, legs: legsOf(chunk) } });
        const list = Array.isArray(res && res.legs) ? res.legs : [];
        const { next, iaDown } = estimatesForChunk(chunk, list);
        unavailable += iaDown;
        setAiEstimates((prev) => ({ ...prev, ...next }));
        chunk.forEach((sel, k) => { if (awaitsReview(list[k])) toReview.push(sel); });
      }
      // Un serveur qui répond déjà avec l'IA (ancienne version) n'a rien à relancer.
      if (toReview.length > 0) {
        setAiPhase("ia");
        for (const chunk of chunksOf(toReview)) {
          try {
            const res = await callApi("/api/analyze", { method: "POST", timeoutMs: 100000, body: { legs: legsOf(chunk) } });
            const { next, iaDown } = estimatesForChunk(chunk, res && res.legs);
            unavailable += iaDown;
            setAiEstimates((prev) => mergeEstimates(prev, next));
          } catch (e) {
            reviewError = e;
          }
        }
      }
      if (reviewError) setAiNotice("La relecture par l'IA n'a pas pu être faite (" + reviewError.message + ") : le modèle statistique répond seul.");
      else if (unavailable > 0) setAiNotice("La relecture par l'IA était indisponible pour " + (unavailable > 1 ? "certaines sélections" : "une sélection") + " : le modèle statistique répond seul.");
    } catch (e) {
      setAiError("Analyse impossible : " + e.message);
    } finally {
      setAiLoading(false); setAiPhase(null);
    }
  };

  const fetchTopMatches = async () => {
    if (topLoading) return;
    setTopLoading(true); setTopError(null);
    try {
      const data = await callApi("/api/top-matches");
      setTopMatches(Array.isArray(data.topMatches) ? data.topMatches : []);
      setTopMeta({
        coteTotale: data.coteTotale,
        probabiliteCombinee: data.probabiliteCombinee,
        objectifCote: data.objectifCote,
        objectifCoteAtteint: data.objectifCoteAtteint,
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
      setTopMatches((prev) => prev.filter((m) => Date.parse(m.date) > Date.now())); // on ne garde pas un match déjà commencé
      setTopError("Impossible de charger les matchs : " + e.message);
    } finally {
      setTopLoading(false);
    }
  };

  const isInDraft = (match) => draft.some((d) => d.equipe1 === match.homeTeam && d.equipe2 === match.awayTeam && d.typePari === match.meilleurPari);

  const addTopMatchToDraft = (match) => {
    if (isInDraft(match)) return;
    const newId = uid();
    setDraft((d) => [...d, {
      id: newId, equipe1: match.homeTeam, equipe2: match.awayTeam,
      typePari: match.meilleurPari, cote: "", matchDate: (match.date || "").slice(0, 10) || todayISO(),
    }]);
    setAiEstimates((prev) => ({ ...prev, [newId]: fromTopMatch(match) }));
  };

  // Coupon automatique : le serveur choisit un pari par match de façon que la cote totale atteigne la cote visée (5), avec des paris aussi
  // fiables que possible. Quand il n'y arrive pas (trop peu de matchs, par exemple), les matchs restent dans la liste pour qu'on puisse en
  // ajouter ; la génération suivante remplace alors les pronostics ajoutés cette fois-ci au lieu de les doubler.
  const generateAutoCoupon = async () => {
    if (matchesToGenerate.length === 0 || genLoading) return;
    setGenLoading(true); setGenReport(null);
    try {
      const batch = matchesToGenerate.slice(0, MAX_LEGS_PER_CALL);
      const res = await callApi("/api/auto-coupon", {
        method: "POST",
        timeoutMs: 100000,
        body: { matches: batch.map((m) => ({ equipe1: m.equipe1, equipe2: m.equipe2 })) },
      });
      const results = Array.isArray(res && res.resultats) ? res.resultats : [];
      const newDraft = []; const newEstimates = {}; const problems = []; const done = new Set();
      batch.forEach((m, i) => {
        const r = results.find((x) => x && x.index === i);
        if (r && r.etat === "ok" && typeof r.probabilite === "number" && r.typePari) {
          const id = uid();
          newDraft.push({ id, equipe1: r.equipe1 || m.equipe1, equipe2: r.equipe2 || m.equipe2, typePari: r.typePari, cote: "", matchDate: (r.date || "").slice(0, 10) || m.matchDate });
          newEstimates[id] = toEstimate(r);
          done.add(m.id);
        } else {
          problems.push(`${m.equipe1} vs ${m.equipe2} : ${toEstimate(r).message}`);
        }
      });
      const unreached = Boolean(res) && res.objectifCoteAtteint === false;
      if (newDraft.length > 0) {
        const replaced = new Set(unreachedAuto.current);
        setDraft((d) => [...d.filter((x) => !replaced.has(x.id)), ...newDraft]);
        setAiEstimates((prev) => {
          const next = { ...prev };
          replaced.forEach((id) => { delete next[id]; });
          return { ...next, ...newEstimates };
        });
        if (!unreached) setMatchesToGenerate((list) => list.filter((m) => !done.has(m.id)));
        unreachedAuto.current = unreached ? newDraft.map((x) => x.id) : [];
      }
      if (problems.length === 0 && !unreached) setActiveTab("build");
      else setGenReport({ added: newDraft.length, problems, notice: unreached ? targetShortfall(res) : undefined });
    } catch (e) {
      setGenReport({ added: 0, problems: [e.message] });
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
    setMatchesToGenerate([...matchesToGenerate, { id: uid(), ...genForm, equipe1: genForm.equipe1.trim(), equipe2: genForm.equipe2.trim() }]);
    setGenForm({ equipe1: "", equipe2: "", matchDate: genForm.matchDate });
  };

  const removeFromGenerate = (id) => setMatchesToGenerate((list) => list.filter((x) => x.id !== id));

  const saveCoupon = () => {
    if (draft.length === 0) return;
    const couponId = uid();
    // L'historique garde les noms reconnus par le serveur quand il y a eu une analyse (« Paris SG » plutôt que « PSG »).
    const entries = draft.map((s) => ({
      id: uid(), couponId, equipe1: (aiEstimates[s.id] && aiEstimates[s.id].equipe1) || s.equipe1, equipe2: (aiEstimates[s.id] && aiEstimates[s.id].equipe2) || s.equipe2, typePari: s.typePari,
      cote: s.cote ? parseFloat(s.cote) : null, matchDate: s.matchDate || todayISO(), statut: "en_attente", date: new Date().toISOString(),
    }));
    persist([...entries, ...pronostics]); // l'enregistrement sur l'appareil est immédiat : le coupon se vide aussitôt
    setDraft([]); setAiEstimates({}); setAiError(null); setAiNotice(null);
  };

  const setSelStatut = async (id, statut) => { await persist(pronostics.map((p) => (p.id === id ? { ...p, statut } : p))); };
  const removeSel = async (id) => { await persist(pronostics.filter((p) => p.id !== id)); };

  const openTab = (key) => {
    setActiveTab(key);
    if (key === "top" && !topLoading && Date.now() - topAt > 5 * 60000) fetchTopMatches();
  };

  return {
    loading, stats, coupons, catalog,
    draft, form, setForm, aiEstimates, analysis, aiLoading, aiPhase, aiError, aiNotice,
    matchesToGenerate, genForm, setGenForm, genLoading, genReport,
    showDetails, toggleDetails: () => setShowDetails((v) => !v),
    activeTab, setActiveTab, openTab,
    topMatches, topMeta, topLoading, topError, topAt,
    addToDraft, removeFromDraft, analyzeWithAI, fetchTopMatches, isInDraft, addTopMatchToDraft,
    generateAutoCoupon, addMatchToGenerate, removeFromGenerate, saveCoupon, setSelStatut, removeSel,
  };
}
