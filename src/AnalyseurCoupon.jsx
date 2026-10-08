import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, X, AlertTriangle, TrendingUp, Zap, Star } from "lucide-react";

// Types de paris reconnus par le serveur (mêmes libellés que l'API). « Autre » sert seulement à l'historique.
const TYPES_PARI = [
  "Victoire domicile",
  "Victoire extérieur",
  "Match nul",
  "Victoire ou nul domicile",
  "Victoire ou nul extérieur",
  "Victoire domicile ou extérieur",
  "Plus de 0.5 buts",
  "Moins de 0.5 buts",
  "Plus de 1.5 buts",
  "Moins de 1.5 buts",
  "Plus de 2.5 buts",
  "Moins de 2.5 buts",
  "Plus de 3.5 buts",
  "Moins de 3.5 buts",
  "Les deux équipes marquent",
  "Les deux équipes ne marquent pas",
  "Equipe domicile 0.5 buts plus",
  "Equipe extérieur 0.5 buts plus",
  "Equipe domicile 1.5 buts plus",
  "Equipe extérieur 1.5 buts plus",
  "Equipe domicile 2.5 buts plus",
  "Equipe extérieur 2.5 buts plus",
  "Victoire/nul domicile + 0.5 buts plus",
  "Victoire/nul extérieur + 0.5 buts plus",
  "Victoire/nul domicile + 1.5 buts plus",
  "Victoire/nul extérieur + 1.5 buts plus",
  "Victoire/nul domicile + 2.5 buts plus",
  "Victoire/nul extérieur + 2.5 buts plus",
  "Victoire domicile + 1.5 buts plus",
  "Victoire extérieur + 1.5 buts plus",
  "Victoire domicile + 2.5 buts plus",
  "Victoire extérieur + 2.5 buts plus",
  "Score exact",
  "Autre",
];

const T = {
  bgDeep: "#0B1F16", surface: "#132A1F", line: "#1F3D2C",
  chalk: "#E9ECE3", chalkDim: "#8FA396", gold: "#D4A72C",
  win: "#4C9A6B", loss: "#C1503A",
};

// Probabilités moyennes d'un match de championnat : utilisées seulement tant qu'aucune analyse n'a été faite.
const BASELINE_RATES = {
  "Victoire domicile": 0.44, "Victoire extérieur": 0.28, "Match nul": 0.28,
  "Victoire ou nul domicile": 0.72, "Victoire ou nul extérieur": 0.56, "Victoire domicile ou extérieur": 0.72,
  "Plus de 0.5 buts": 0.92, "Moins de 0.5 buts": 0.08, "Plus de 1.5 buts": 0.75,
  "Moins de 1.5 buts": 0.25, "Plus de 2.5 buts": 0.49, "Moins de 2.5 buts": 0.51,
  "Plus de 3.5 buts": 0.27, "Moins de 3.5 buts": 0.73, "Les deux équipes marquent": 0.54,
  "Les deux équipes ne marquent pas": 0.46, "Equipe domicile 0.5 buts plus": 0.78, "Equipe extérieur 0.5 buts plus": 0.68,
  "Equipe domicile 1.5 buts plus": 0.44, "Equipe extérieur 1.5 buts plus": 0.32, "Equipe domicile 2.5 buts plus": 0.19,
  "Equipe extérieur 2.5 buts plus": 0.11, "Victoire/nul domicile + 0.5 buts plus": 0.64, "Victoire/nul extérieur + 0.5 buts plus": 0.48,
  "Victoire/nul domicile + 1.5 buts plus": 0.54, "Victoire/nul extérieur + 1.5 buts plus": 0.41, "Victoire/nul domicile + 2.5 buts plus": 0.33,
  "Victoire/nul extérieur + 2.5 buts plus": 0.23, "Victoire domicile + 1.5 buts plus": 0.35, "Victoire extérieur + 1.5 buts plus": 0.21,
  "Victoire domicile + 2.5 buts plus": 0.27, "Victoire extérieur + 2.5 buts plus": 0.16, "Score exact": 0.1,
  "Autre": 0.4,
};

// Adresse du serveur : modifiable au moment de la construction avec REACT_APP_API_URL.
const API_BASE = (process.env.REACT_APP_API_URL || "https://analyseur-foot-api.onrender.com").replace(/\/+$/, "");

// Appel du serveur avec délai maximal et messages d'erreur lisibles.
export async function callApi(path, { method = "GET", body, timeoutMs = 70000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    if (!res.ok) {
      const err = new Error((json && json.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Le serveur met trop de temps à répondre. Réessayez dans un instant.");
    if (e instanceof TypeError) throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Transforme la réponse du serveur pour une sélection. Sans analyse chiffrée, p vaut null : aucune probabilité n'est inventée.
export function toEstimate(r) {
  if (!r) return { p: null, message: "Pas de réponse du serveur pour cette sélection." };
  if (r.etat === "ok" && typeof r.probabilite === "number") {
    return {
      p: Math.min(0.99, Math.max(0.01, r.probabilite / 100)),
      reason: r.justification,
      vigilance: r.vigilance,
      confidence: r.niveauConfiance,
      statsEquipe1: r.statsEquipe1,
      statsEquipe2: r.statsEquipe2,
      h2h: r.h2h,
      homeAway1: r.homeAway1,
      homeAway2: r.homeAway2,
    };
  }
  const sug = r.suggestions ? [...(r.suggestions.equipe1 || []), ...(r.suggestions.equipe2 || [])].slice(0, 4) : [];
  return { p: null, message: (r.message || "Analyse impossible pour cette sélection.") + (sug.length ? ` Suggestions : ${sug.join(", ")}.` : "") };
}

const clampP = (p) => Math.min(0.99, Math.max(0.01, p));
const MAX_LEGS_PER_CALL = 12; // limite du serveur pour une requête

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Clé d'un match (sans accents ni majuscules) : sert à repérer deux paris sur le même match.
const normName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const matchKey = (sel) => normName(sel.equipe1) + "|" + normName(sel.equipe2);

const CONFIDENCE_LABEL = { faible: "faible", moyen: "moyenne", eleve: "élevée" };
const confidenceLabel = (c) => CONFIDENCE_LABEL[c] || c || "—";

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

// Libellés d'anciennes versions : l'historique déjà enregistré continue de compter.
const LEGACY_LABELS = { "Total buts 1.5 plus": "Plus de 1.5 buts", "Victoire exterieur": "Victoire extérieur" };
const canonicalLabel = (label) => LEGACY_LABELS[label] || label;

function historicalRate(pronostics, typePari) {
  const items = pronostics.filter((p) => canonicalLabel(p.typePari) === typePari && p.statut !== "en_attente");
  if (items.length < 3) return null;
  return { rate: items.filter((p) => p.statut === "gagne").length / items.length, n: items.length };
}

// Une seule source par sélection : l'analyse du serveur si elle existe ; sinon l'historique personnel (lissé vers la
// moyenne, car trois paris gagnés ne prouvent rien) ; sinon la moyenne générale du type de pari.
export function estimateProb(pronostics, sel, aiEstimates) {
  const ai = aiEstimates[sel.id];
  if (ai && typeof ai.p === "number") return { p: ai.p, source: "analyse", stats: ai.statsEquipe1 || ai.statsEquipe2 };
  const base = BASELINE_RATES[sel.typePari] ?? 0.4;
  const hist = historicalRate(pronostics, sel.typePari);
  if (hist) return { p: (hist.rate * hist.n + base * 8) / (hist.n + 8), source: "historique", n: hist.n };
  return { p: base, source: "general" };
}

// Associe chaque sélection envoyée à la réponse du serveur (même ordre). iaDown : sélections que l'IA n'a pas pu relire.
export function estimatesForChunk(chunk, results) {
  const list = Array.isArray(results) ? results : [];
  const next = {};
  let iaDown = 0;
  chunk.forEach((sel, k) => {
    const r = list[k];
    next[sel.id] = toEstimate(r);
    if (r && r.etat === "ok" && r.ia && r.ia.statut === "indisponible") iaDown += 1;
  });
  return { next, iaDown };
}

// Estimation d'un match du « Top Matchs » (déjà analysé par le serveur).
export function fromTopMatch(m) {
  if (!m || typeof m.probabilite !== "number") return { p: null, message: "Probabilité indisponible pour ce match." };
  return {
    p: clampP(m.probabilite / 100),
    reason: m.justification,
    vigilance: m.vigilance,
    confidence: m.niveauConfiance,
    statsEquipe1: m.statsHome,
    statsEquipe2: m.statsAway,
    h2h: m.h2h,
    homeAway1: m.homeAway1,
    homeAway2: m.homeAway2,
  };
}

export default function App() {
  const { pronostics, persist, loading } = useStore();
  const [draft, setDraft] = useState([]);
  const [form, setForm] = useState({ equipe1: "", equipe2: "", typePari: TYPES_PARI[0], cote: "", matchDate: todayISO() });
  const [aiEstimates, setAiEstimates] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiNotice, setAiNotice] = useState(null);
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
    const keys = draft.map(matchKey);
    const sameMatch = new Set(keys).size < keys.length;
    return { evals, combined, weakest, combinedWithout, pending, sameMatch };
  }, [draft, pronostics, aiEstimates]);

  const addToDraft = () => {
    if (!form.equipe1.trim() || !form.equipe2.trim()) return;
    setDraft([...draft, { id: uid(), ...form, equipe1: form.equipe1.trim(), equipe2: form.equipe2.trim() }]);
    setForm({ ...form, equipe1: "", equipe2: "", cote: "" });
  };

  // Analyse du coupon par le serveur (modèle statistique + relecture IA). Aucune probabilité n'est inventée côté site.
  const analyzeWithAI = async () => {
    if (draft.length === 0 || aiLoading) return;
    setAiLoading(true); setAiError(null); setAiNotice(null);
    let unavailable = 0;
    try {
      for (let i = 0; i < draft.length; i += MAX_LEGS_PER_CALL) {
        const chunk = draft.slice(i, i + MAX_LEGS_PER_CALL);
        const res = await callApi("/api/analyze", {
          method: "POST",
          timeoutMs: 100000,
          body: { legs: chunk.map((s) => ({ equipe1: s.equipe1, equipe2: s.equipe2, typePari: s.typePari })) },
        });
        const { next, iaDown } = estimatesForChunk(chunk, res && res.legs);
        unavailable += iaDown;
        setAiEstimates((prev) => ({ ...prev, ...next }));
      }
      if (unavailable > 0) setAiNotice("La relecture par l'IA était indisponible pour " + (unavailable > 1 ? "certaines sélections" : "une sélection") + " : le modèle statistique répond seul.");
    } catch (e) {
      setAiError("Analyse impossible : " + e.message);
    } finally {
      setAiLoading(false);
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
        objectifCoteAtteint: data.objectifCoteAtteint,
        objectifCote: data.objectifCote,
        avertissement: data.avertissement,
        avertissementDonnees: data.avertissementDonnees,
        message: data.message,
        ia: data.ia,
        complet: data.complet,
        perime: data.perime,
        fenetreHeures: data.fenetreHeures,
        nbChampionnats: data.donnees && Array.isArray(data.donnees.championnatsPrets) ? data.donnees.championnatsPrets.length : null,
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

  // Coupon automatique : le serveur choisit le pari le plus probable de chaque match saisi.
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
      if (newDraft.length > 0) {
        setDraft((d) => [...d, ...newDraft]);
        setAiEstimates((prev) => ({ ...prev, ...newEstimates }));
        setMatchesToGenerate((list) => list.filter((m) => !done.has(m.id)));
      }
      if (problems.length === 0) setActiveTab("build");
      else setGenReport({ added: newDraft.length, problems });
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

  const saveCoupon = async () => {
    if (draft.length === 0) return;
    const couponId = uid();
    const entries = draft.map((s) => ({
      id: uid(), couponId, equipe1: s.equipe1, equipe2: s.equipe2, typePari: s.typePari,
      cote: s.cote ? parseFloat(s.cote) : null, matchDate: s.matchDate || todayISO(), statut: "en_attente", date: new Date().toISOString(),
    }));
    await persist([...entries, ...pronostics]);
    setDraft([]); setAiEstimates({}); setAiError(null); setAiNotice(null);
  };

  const setSelStatut = async (id, statut) => { await persist(pronostics.map((p) => (p.id === id ? { ...p, statut } : p))); };
  const removeSel = async (id) => { await persist(pronostics.filter((p) => p.id !== id)); };
  const verdict = (p) => p >= 0.5 ? { label: "Jouable", color: T.win } : p >= 0.25 ? { label: "Risqué", color: T.gold } : { label: "Très risqué", color: T.loss };

  const openTab = (key) => {
    setActiveTab(key);
    if (key === "top" && !topLoading && Date.now() - topAt > 5 * 60000) fetchTopMatches();
  };

  if (loading) return <div style={{ minHeight: "100vh", background: T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", color: T.chalkDim }}>Chargement…</div>;

  const noteStyle = (color) => ({ display: "flex", gap: 6, alignItems: "flex-start", color, fontSize: 11, marginTop: 6, lineHeight: 1.4 });
  const sectionTitle = { fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 };
  const iaDown = topMeta && topMeta.ia && (topMeta.ia.statut === "indisponible" || topMeta.ia.statut === "partielle");
  const iaOff = topMeta && topMeta.ia && topMeta.ia.statut === "desactivee";

  return (
    <div style={{ minHeight: "100vh", background: T.bgDeep, color: T.chalk, padding: "10px", maxWidth: 500, margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600&display=swap'); *{box-sizing:border-box} body{margin:0} input,select,button{font-size:16px!important}`}</style>

      <div style={{ textAlign: "center", padding: "14px 0 10px" }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Analyseur Foot Pro</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", fontSize: 12, color: T.chalkDim, marginTop: 4 }}>
          <span>Réussite : <b style={{ color: T.gold }}>{stats.rate !== null ? stats.rate + " %" : "-"}</b></span>
          <span>Clôturés : <b>{stats.closedCount}</b></span>
        </div>
      </div>

      <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line}` }}>
        {[
          { key: "top", label: "Top Matchs" }, { key: "build", label: "Mon coupon" },
          { key: "gen", label: "Auto" }, { key: "history", label: "Historique" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => openTab(tab.key)}
            style={{ flex: 1, padding: "10px 4px", background: activeTab === tab.key ? T.gold : "transparent", color: activeTab === tab.key ? T.bgDeep : T.chalkDim, border: "none", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TOP MATCHS */}
      {activeTab === "top" && (
        <div>
          <div style={{ background: T.surface, border: `1px solid ${T.gold}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Zap size={18} color={T.gold}/>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: T.gold }}>Top 3 Matchs à venir</span>
            </div>
            <div style={{ fontSize: 12, color: T.chalkDim, marginBottom: 10 }}>
              {topMeta && topMeta.nbChampionnats
                ? `Analyse de ${topMeta.nbChampionnats} championnat${topMeta.nbChampionnats > 1 ? "s" : ""}, matchs des ${topMeta.fenetreHeures} prochaines heures.`
                : "Analyse des championnats couverts par le serveur."}
            </div>
            {topLoading && <div style={{ textAlign: "center", padding: 20, color: T.chalkDim }}>Analyse des matchs en cours… (jusqu'à une minute)</div>}
            {topError && <div style={{ color: T.loss, fontSize: 12, marginBottom: 8 }}>{topError}</div>}
            {!topLoading && topMeta && topMeta.message && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>{topMeta.message}</span></div>}
            {!topLoading && iaDown && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>La relecture par l'IA n'a pas pu être faite pour tous les matchs : ces probabilités viennent du modèle statistique seul.</span></div>}
            {!topLoading && iaOff && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>La relecture par l'IA est désactivée sur le serveur : probabilités du modèle statistique seul.</span></div>}
            {!topLoading && topMeta && topMeta.perime && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>Sélection précédente conservée : les données n'ont pas pu être actualisées.</span></div>}
            {!topLoading && topMeta && topMeta.complet === false && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>Certains championnats sont encore en cours de chargement : la sélection peut évoluer dans quelques minutes.</span></div>}
            {!topLoading && topMeta && topMeta.avertissementDonnees && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>{topMeta.avertissementDonnees}</span></div>}

            {!topLoading && topMatches.length > 0 && topMeta && (
              <div style={{ background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, margin: "10px 0", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span>Cote combinée estimée : <b style={{ color: T.gold }}>{topMeta.coteTotale}</b></span>
                  <span>Probabilité combinée : <b>{topMeta.probabiliteCombinee} %</b></span>
                </div>
                {topMeta.objectifCoteAtteint === false && <div style={{ color: T.chalkDim, fontSize: 11, marginTop: 4 }}>Objectif de cote ({topMeta.objectifCote}) non atteint avec les matchs disponibles.</div>}
                {topMeta.avertissement && <div style={{ color: T.chalkDim, fontSize: 10, marginTop: 4 }}>{topMeta.avertissement}</div>}
              </div>
            )}

            {topMatches.map((match, i) => (
              <div key={match.id || i} style={{ border: `1px solid ${i === 0 ? T.gold : T.line}`, borderRadius: 8, padding: 12, marginBottom: 8, background: i === 0 ? `${T.gold}11` : T.bgDeep }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i === 0 && <Star size={16} color={T.gold} fill={T.gold}/>}
                    <span style={{ fontSize: 10, color: T.chalkDim, background: T.surface, padding: "2px 8px", borderRadius: 4 }}>{match.competition}</span>
                  </div>
                  <span style={{ fontSize: 10, color: T.chalkDim }}>{formatDate(match.date)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{match.homeTeam} vs {match.awayTeam}</div>
                <div style={{ fontSize: 12, color: T.gold, marginBottom: 4 }}>Pari conseillé : <b>{match.meilleurPari}</b></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 22, color: match.probabilite >= 70 ? T.win : match.probabilite >= 55 ? T.gold : T.loss }}>{match.probabilite} %</span>
                  <span style={{ fontSize: 10, color: T.chalkDim, textTransform: "uppercase" }}>Confiance : {confidenceLabel(match.niveauConfiance)}</span>
                  {typeof match.coteEstimee === "number" && <span style={{ fontSize: 10, color: T.chalkDim }}>Cote estimée {match.coteEstimee.toFixed(2)}</span>}
                </div>
                {showDetails && <div style={{ fontSize: 11, color: T.chalkDim, marginBottom: 6, fontStyle: "italic" }}>{match.justification}</div>}
                {showDetails && match.vigilance && <div style={{ fontSize: 11, color: T.gold, marginBottom: 6 }}>À surveiller : {match.vigilance}</div>}
                <button onClick={() => addTopMatchToDraft(match)} disabled={isInDraft(match)} style={{ width: "100%", padding: 8, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer", opacity: isInDraft(match) ? 0.5 : 1 }}>{isInDraft(match) ? "Déjà dans le coupon" : "Ajouter ce pronostic"}</button>
              </div>
            ))}

            {!topLoading && topAt === 0 && topMatches.length === 0 && !topError && (
              <button onClick={fetchTopMatches} style={{ width: "100%", padding: 14, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Chercher les meilleurs matchs</button>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {!topLoading && (topAt > 0 || topError) && (
                <button onClick={fetchTopMatches} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>Actualiser</button>
              )}
              <button onClick={() => setShowDetails(!showDetails)} style={{ background: "transparent", border: "none", color: T.chalkDim, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{showDetails ? "Masquer" : "Détails"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MON COUPON */}
      {activeTab === "build" && (
        <>
          {draft.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={sectionTitle}>Coupon ({draft.length} {draft.length > 1 ? "matchs" : "match"})</div>
              {draft.map((sel) => {
                const ev = analysis?.evals.find((e) => e.sel.id === sel.id);
                const aiData = aiEstimates[sel.id];
                const detailed = aiData && typeof aiData.p === "number";
                return (
                  <div key={sel.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <b>{sel.equipe1} vs {sel.equipe2}</b>
                        <div style={{ color: T.chalkDim, fontSize: 12 }}>{sel.typePari}</div>
                        {ev && !ev.failed && ev.source === "historique" && <div style={{ color: T.chalkDim, fontSize: 10 }}>Estimation d'après votre historique ({ev.n} paris), pas encore analysé</div>}
                        {ev && !ev.failed && ev.source === "general" && <div style={{ color: T.chalkDim, fontSize: 10 }}>Moyenne générale de ce pari, pas encore analysé</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {ev && (ev.failed
                          ? <span title={ev.message} style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: T.gold, fontSize: 15 }}>?</span>
                          : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: ev.source !== "analyse" ? T.chalkDim : ev.p >= 0.5 ? T.win : T.loss, fontSize: 15 }}>{ev.source !== "analyse" ? "~" : ""}{Math.round(ev.p * 100)} %</span>)}
                        <button aria-label="Retirer cette sélection" onClick={() => setDraft(draft.filter((x) => x.id !== sel.id))} style={{ background: "transparent", border: "none", color: T.chalkDim, cursor: "pointer" }}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    {ev && ev.failed && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>{ev.message}</span></div>}
                    {detailed && showDetails && aiData.reason && (
                      <div style={{ marginTop: 6, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11, fontStyle: "italic", color: T.chalkDim }}>{aiData.reason}</div>
                    )}
                    {detailed && showDetails && aiData.vigilance && (
                      <div style={{ marginTop: 6, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11, color: T.gold }}>À surveiller : {aiData.vigilance}</div>
                    )}
                    {detailed && showDetails && aiData.confidence && (
                      <div style={{ marginTop: 6, fontSize: 10, color: T.chalkDim, textTransform: "uppercase" }}>Confiance : {confidenceLabel(aiData.confidence)}</div>
                    )}
                    {aiData?.h2h && showDetails && (
                      <div style={{ marginTop: 6, padding: 6, background: `${T.gold}11`, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>Confrontations directes :</div>
                        {aiData.h2h.matches?.map((m, i) => (
                          <div key={i} style={{ color: T.chalkDim }}>{m.homeTeam} {m.score} {m.awayTeam}</div>
                        ))}
                        <div style={{ color: T.chalk, marginTop: 3, fontWeight: 600 }}>
                          Bilan : {aiData.h2h.bilan?.homeWins} V domicile - {aiData.h2h.bilan?.draws} N - {aiData.h2h.bilan?.awayWins} V extérieur
                        </div>
                      </div>
                    )}
                    {aiData?.homeAway1?.home && showDetails && (
                      <div style={{ marginTop: 6, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>{sel.equipe1} à domicile :</div>
                        <div style={{ color: T.chalkDim }}>{aiData.homeAway1.home.won}V/{aiData.homeAway1.home.draw}N/{aiData.homeAway1.home.lost}D - {aiData.homeAway1.home.goalsFor} buts / {aiData.homeAway1.home.goalsAgainst} encaissés</div>
                        <div style={{ color: T.chalkDim, fontSize: 10 }}>Moy : {aiData.homeAway1.home.avgGoalsFor} buts marqués/match</div>
                      </div>
                    )}
                    {aiData?.homeAway2?.away && showDetails && (
                      <div style={{ marginTop: 4, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>{sel.equipe2} à l'extérieur :</div>
                        <div style={{ color: T.chalkDim }}>{aiData.homeAway2.away.won}V/{aiData.homeAway2.away.draw}N/{aiData.homeAway2.away.lost}D - {aiData.homeAway2.away.goalsFor} buts / {aiData.homeAway2.away.goalsAgainst} encaissés</div>
                        <div style={{ color: T.chalkDim, fontSize: 10 }}>Moy : {aiData.homeAway2.away.avgGoalsFor} buts marqués/match</div>
                      </div>
                    )}
                  </div>
                );
              })}

              {analysis && (
                <div style={{ background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginTop: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 36, color: analysis.pending > 0 ? T.chalkDim : verdict(analysis.combined).color }}>{analysis.pending > 0 ? "~" : ""}{Math.round(analysis.combined * 100)} %</div>
                    {analysis.pending > 0
                      ? <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, border: `1px solid ${T.chalkDim}`, color: T.chalkDim, fontWeight: 600, fontSize: 12 }}>Estimation indicative</div>
                      : <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: verdict(analysis.combined).color, color: T.bgDeep, fontWeight: 600, fontSize: 12 }}>{verdict(analysis.combined).label}</div>}
                    {analysis.pending === 0 && <div style={{ fontSize: 11, color: T.chalkDim, marginTop: 6 }}>Cote équitable estimée : {(1 / analysis.combined).toFixed(2)} (sans marge de bookmaker : les cotes réelles seront plus basses)</div>}
                  </div>
                  {analysis.pending > 0 && (
                    <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>{analysis.pending > 1 ? `${analysis.pending} sélections n'ont` : "1 sélection n'a"} pas d'analyse chiffrée : le pourcentage est indicatif. Appuyez sur « Analyser ».</span></div>
                  )}
                  {analysis.sameMatch && (
                    <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>Plusieurs paris portent sur le même match : ils sont liés entre eux, le pourcentage combiné peut être inexact.</span></div>
                  )}
                  {analysis.pending === 0 && draft.length > 1 && analysis.combinedWithout !== null && (
                    <div style={{ fontSize: 11, color: T.chalkDim, marginTop: 8, textAlign: "center" }}>
                      Sélection la plus fragile : {analysis.weakest.sel.equipe1} vs {analysis.weakest.sel.equipe2} ({Math.round(analysis.weakest.p * 100)} %). Sans elle : {Math.round(analysis.combinedWithout * 100)} %.
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <button onClick={() => setShowDetails(!showDetails)} style={{ background: "transparent", border: "none", color: T.chalkDim, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{showDetails ? "Masquer" : "Détails"}</button>
                    <button onClick={analyzeWithAI} disabled={aiLoading} style={{ background: T.gold, color: T.bgDeep, border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={14}/> {aiLoading ? "Analyse…" : "Analyser"}
                    </button>
                  </div>
                  {aiLoading && <div style={{ color: T.chalkDim, fontSize: 11, marginTop: 6 }}>Analyse en cours : jusqu'à une minute pour un grand coupon.</div>}
                  {aiNotice && <div style={noteStyle(T.gold)}><AlertTriangle size={14} style={{ flexShrink: 0 }}/><span>{aiNotice}</span></div>}
                  {aiError && <div style={{ color: T.loss, fontSize: 11, marginTop: 6 }}>{aiError}</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={sectionTitle}>Ajouter un match</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input aria-label="Équipe 1 (à domicile)" placeholder="Équipe 1" value={form.equipe1} onChange={(e) => setForm({ ...form, equipe1: e.target.value })} style={inputStyle()} />
              <span style={{ color: T.chalkDim, fontWeight: 600 }}>VS</span>
              <input aria-label="Équipe 2 (à l'extérieur)" placeholder="Équipe 2" value={form.equipe2} onChange={(e) => setForm({ ...form, equipe2: e.target.value })} style={inputStyle()} />
            </div>
            <select aria-label="Type de pari" value={form.typePari} onChange={(e) => setForm({ ...form, typePari: e.target.value })} style={{ ...inputStyle(), width: "100%", marginBottom: 8 }}>
              {TYPES_PARI.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addToDraft} style={{ width: "100%", padding: 12, background: "transparent", border: `2px dashed ${T.line}`, color: T.gold, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={16}/> Ajouter
            </button>
            <div style={{ fontSize: 10, color: T.chalkDim, marginTop: 8 }}>L'équipe 1 reçoit (domicile), l'équipe 2 se déplace : « Victoire domicile » désigne l'équipe 1.</div>
          </div>

          {draft.length > 0 && (
            <button onClick={saveCoupon} style={{ width: "100%", padding: 14, background: T.win, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 20 }}>Enregistrer</button>
          )}
        </>
      )}

      {/* GÉNÉRATION AUTO */}
      {activeTab === "gen" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
          <div style={sectionTitle}>Génération automatique</div>
          <div style={{ fontSize: 12, color: T.chalkDim, marginBottom: 10 }}>
            Saisissez des matchs : le serveur choisit pour chacun le pari le plus sûr dont la probabilité reste intéressante (entre 55 % et 88 %). L'équipe 1 reçoit, l'équipe 2 se déplace.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input aria-label="Équipe 1 du match à générer" placeholder="Équipe 1" value={genForm.equipe1} onChange={(e) => setGenForm({ ...genForm, equipe1: e.target.value })} style={inputStyle()} />
            <input aria-label="Équipe 2 du match à générer" placeholder="Équipe 2" value={genForm.equipe2} onChange={(e) => setGenForm({ ...genForm, equipe2: e.target.value })} style={inputStyle()} />
          </div>
          <button onClick={addMatchToGenerate} style={{ width: "100%", padding: 10, marginBottom: 8, background: "transparent", border: `2px dashed ${T.line}`, color: T.gold, borderRadius: 6, cursor: "pointer" }}><Plus size={14}/> Ajouter</button>
          {matchesToGenerate.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: T.bgDeep, borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
              <span>{m.equipe1} vs {m.equipe2}</span>
              <button aria-label={`Retirer ${m.equipe1} vs ${m.equipe2}`} onClick={() => setMatchesToGenerate(matchesToGenerate.filter((x) => x.id !== m.id))} style={{ background: "transparent", border: "none", color: T.chalkDim, cursor: "pointer" }}><Trash2 size={12}/></button>
            </div>
          ))}
          {genReport && (
            <div style={{ margin: "8px 0", padding: 10, background: T.bgDeep, border: `1px solid ${genReport.added > 0 ? T.gold : T.loss}`, borderRadius: 8, fontSize: 12 }}>
              {genReport.added > 0 && (
                <div style={{ color: T.win, marginBottom: 6 }}>
                  {genReport.added} pronostic{genReport.added > 1 ? "s ajoutés" : " ajouté"} à « Mon coupon ».{" "}
                  <button onClick={() => setActiveTab("build")} style={{ background: "transparent", border: "none", color: T.gold, textDecoration: "underline", cursor: "pointer", padding: 0 }}>Voir mon coupon</button>
                </div>
              )}
              {genReport.problems.map((pb, i) => (
                <div key={i} style={{ color: genReport.added > 0 ? T.gold : T.loss, marginTop: 2 }}>{pb}</div>
              ))}
            </div>
          )}
          <button onClick={generateAutoCoupon} disabled={matchesToGenerate.length === 0 || genLoading} style={{ width: "100%", padding: 12, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: matchesToGenerate.length === 0 ? 0.5 : 1 }}>
            {genLoading ? "Génération…" : "Générer mon coupon"}
          </button>
          {genLoading && <div style={{ color: T.chalkDim, fontSize: 11, marginTop: 6, textAlign: "center" }}>Analyse en cours : jusqu'à une minute.</div>}
        </div>
      )}

      {/* HISTORIQUE */}
      {activeTab === "history" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
          <div style={sectionTitle}>Historique</div>
          {coupons.length === 0 && <div style={{ textAlign: "center", color: T.chalkDim, padding: 20 }}>Aucun coupon</div>}
          {coupons.map((group) => {
            const allDone = group.every((p) => p.statut !== "en_attente");
            const won = allDone && group.every((p) => p.statut === "gagne");
            return (
              <div key={group[0].couponId || group[0].id} style={{ border: `1px solid ${!allDone ? T.line : won ? T.win : T.loss}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: T.chalkDim }}>
                  <span>{new Date(group[0].date).toLocaleDateString("fr-FR")}</span>
                  <span style={{ color: !allDone ? T.gold : won ? T.win : T.loss, fontWeight: 600 }}>{!allDone ? "En attente" : won ? "Gagné" : "Perdu"}</span>
                </div>
                {group.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                    <span style={{ flex: 1 }}>{p.equipe1} vs {p.equipe2} - {p.typePari}</span>
                    {p.statut === "en_attente" ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button aria-label="Marquer comme gagné" onClick={() => setSelStatut(p.id, "gagne")} style={iconBtn(T.win)}><Check size={12}/></button>
                        <button aria-label="Marquer comme perdu" onClick={() => setSelStatut(p.id, "perdu")} style={iconBtn(T.loss)}><X size={12}/></button>
                      </div>
                    ) : (
                      <span style={{ color: p.statut === "gagne" ? T.win : T.loss, fontWeight: 600 }}>{p.statut === "gagne" ? "V" : "X"}</span>
                    )}
                    <button aria-label="Supprimer ce pari" onClick={() => removeSel(p.id)} style={{ background: "transparent", border: "none", color: T.chalkDim, marginLeft: 6, cursor: "pointer" }}><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: T.chalkDim, textAlign: "center", padding: "14px 8px 28px", lineHeight: 1.5 }}>
        Probabilités estimées par un modèle statistique relu par l'IA : ce ne sont jamais des certitudes. Les cotes affichées sont des cotes équitables estimées, sans marge de bookmaker. Jouez avec modération.
      </div>
    </div>
  );
}

function inputStyle() {
  return { background: "#0B1F16", border: "1px solid #1F3D2C", borderRadius: 6, padding: "10px", color: "#E9ECE3", fontSize: 14, width: "100%" };
}

function iconBtn(color) {
  return { background: "transparent", border: `1px solid ${color}`, borderRadius: 4, color, cursor: "pointer", padding: "2px 6px" };
}
