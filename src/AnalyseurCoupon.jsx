import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, X, Clock, AlertTriangle, Wand2, TrendingUp, BarChart3, Zap, Star } from "lucide-react";

const TYPES_PARI = [
  "Victoire domicile",
  "Victoire extérieur",
  "Match nul",
  "Victoire ou nul domicile",
  "Victoire ou nul extérieur",
  "Plus de 1.5 buts",
  "Plus de 2.5 buts",
  "Moins de 2.5 buts",
  "Total buts 1.5 plus",
  "Equipe domicile 0.5 buts plus",
  "Equipe extérieur 0.5 buts plus",
  "Victoire/nul domicile + 0.5 buts plus",
  "Victoire/nul extérieur + 0.5 buts plus",
  "Victoire/nul domicile + 1.5 buts plus",
  "Victoire/nul extérieur + 1.5 buts plus",
  "Les deux équipes marquent",
  "Score exact",
  "Autre",
];

const T = {
  bgDeep: "#0B1F16", surface: "#132A1F", line: "#1F3D2C",
  chalk: "#E9ECE3", chalkDim: "#8FA396", gold: "#D4A72C",
  win: "#4C9A6B", loss: "#C1503A",
};

const BASELINE_RATES = {
  "Victoire domicile": 0.45, "Victoire extérieur": 0.30, "Match nul": 0.25,
  "Victoire ou nul domicile": 0.70, "Victoire ou nul extérieur": 0.55,
  "Plus de 1.5 buts": 0.75, "Plus de 2.5 buts": 0.50, "Moins de 2.5 buts": 0.50,
  "Total buts 1.5 plus": 0.75, "Equipe domicile 0.5 buts plus": 0.65,
  "Equipe extérieur 0.5 buts plus": 0.55, "Victoire/nul domicile + 0.5 buts plus": 0.55,
  "Victoire/nul extérieur + 0.5 buts plus": 0.45, "Victoire/nul domicile + 1.5 buts plus": 0.40,
  "Victoire/nul extérieur + 1.5 buts plus": 0.30, "Les deux équipes marquent": 0.50,
  "Score exact": 0.08, "Autre": 0.40,
};

const API_URL = "https://analyseur-foot-api.onrender.com/api/analyze";
const API_SIMPLE_URL = "https://analyseur-foot-api.onrender.com/api/analyze-simple";
const API_TOP_URL = "https://analyseur-foot-api.onrender.com/api/top-matches";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function tomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function formatMatchDate(iso) {
  if (!iso) return ""; const today = todayISO(); const tomorrow = tomorrowISO();
  if (iso === today) return "Auj."; if (iso === tomorrow) return "Dem.";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

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

function historicalRate(pronostics, typePari) {
  const items = pronostics.filter((p) => p.typePari === typePari && p.statut !== "en_attente");
  if (items.length < 3) return null;
  return { rate: items.filter((p) => p.statut === "gagne").length / items.length, n: items.length };
}

function estimateProb(pronostics, sel, aiEstimates) {
  const hist = historicalRate(pronostics, sel.typePari);
  if (hist) return { p: hist.rate, source: "historique", n: hist.n };
  const ai = aiEstimates[sel.id];
  if (ai) return { p: ai.p, source: "IA", stats: ai.statsEquipe1 || ai.statsEquipe2 };
  return { p: BASELINE_RATES[sel.typePari] ?? 0.4, source: "general" };
}

export default function App() {
  const { pronostics, persist, loading } = useStore();
  const [draft, setDraft] = useState([]);
  const [form, setForm] = useState({ equipe1: "", equipe2: "", typePari: TYPES_PARI[0], cote: "", matchDate: todayISO() });
  const [aiEstimates, setAiEstimates] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [matchesToGenerate, setMatchesToGenerate] = useState([]);
  const [genForm, setGenForm] = useState({ equipe1: "", equipe2: "", matchDate: todayISO() });
  const [genLoading, setGenLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("build");
  const [topMatches, setTopMatches] = useState([]);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState(null);

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
    const evals = draft.map((sel) => ({ sel, ...estimateProb(pronostics, sel, aiEstimates) }));
    const combined = evals.reduce((acc, e) => acc * e.p, 1);
    const weakest = [...evals].sort((a, b) => a.p - b.p)[0];
    const withoutWeakest = evals.filter((e) => e.sel.id !== weakest.sel.id);
    const combinedWithout = withoutWeakest.length > 0 ? withoutWeakest.reduce((acc, e) => acc * e.p, 1) : null;
    return { evals, combined, weakest, combinedWithout };
  }, [draft, pronostics, aiEstimates]);

  const addToDraft = () => {
    if (!form.equipe1.trim() || !form.equipe2.trim()) return;
    setDraft([...draft, { id: uid(), ...form, equipe1: form.equipe1.trim(), equipe2: form.equipe2.trim() }]);
    setForm({ ...form, equipe1: "", equipe2: "", cote: "" });
  };

  const analyzeWithAI = async () => {
    if (draft.length === 0) return;
    setAiLoading(true); setAiError(null);
    try {
      const next = {};
      for (const sel of draft) {
        const res = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipe1: sel.equipe1, equipe2: sel.equipe2, typePari: sel.typePari }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const result = await res.json();
        next[sel.id] = {
  p: Math.min(0.97, Math.max(0.03, result.probabilite / 100)),
  reason: result.justification,
  statsEquipe1: result.statsEquipe1,
  statsEquipe2: result.statsEquipe2,
  h2h: result.h2h,
  homeAway1: result.homeAway1,
  homeAway2: result.homeAway2,
};
      }
      setAiEstimates(next);
    } catch (e) { setAiError("Analyse echouee: " + e.message); } finally { setAiLoading(false); }
  };

  const fetchTopMatches = async () => {
    setTopLoading(true); setTopError(null);
    try {
      const res = await fetch(API_TOP_URL);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setTopMatches(data.topMatches || []);
    } catch (e) { setTopError("Impossible de charger les matchs: " + e.message); } finally { setTopLoading(false); }
  };

  const addTopMatchToDraft = (match) => {
    const newId = uid();
    setDraft([...draft, {
      id: newId, equipe1: match.homeTeam, equipe2: match.awayTeam,
      typePari: match.meilleurPari, cote: "", matchDate: todayISO(),
    }]);
    setAiEstimates((prev) => ({
      ...prev,
      [newId]: {
        p: match.probabilite / 100,
        reason: match.justification,
        statsEquipe1: match.statsHome,
        statsEquipe2: match.statsAway,
        h2h: match.h2h,
      },
    }));
  };

  const callAnthropicSimple = async (prompt, maxTokens = 1500) => {
    const res = await fetch(API_SIMPLE_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    const data = await res.json();
    return data.content.map((b) => b.text || "").join("").replace(/```json|```/g, "").trim();
  };

  const generateAutoCoupon = async () => {
    if (matchesToGenerate.length === 0) return;
    setGenLoading(true);
    try {
      const list = matchesToGenerate.map((m, i) => `${i}. ${m.equipe1} vs ${m.equipe2}`).join("\n");
      const prompt = `Tu es un analyste football prudent. Pour chaque match ci-dessous, choisis parmi cette liste de types de paris : ${TYPES_PARI.join(", ")} - celui qui a la plus grande chance de se realiser.\n\nMatchs:\n${list}\n\nJSON: [{"index":0,"typePari":"...","probabilite":00,"justification":"..."}]`;
      const text = await callAnthropicSimple(prompt, 1500);
      const parsed = JSON.parse(text);
      const newDraft = []; const newAiEstimates = {};
      parsed.forEach((item) => {
        const m = matchesToGenerate[item.index];
        if (!m || !TYPES_PARI.includes(item.typePari)) return;
        const id = uid();
        newDraft.push({ id, equipe1: m.equipe1, equipe2: m.equipe2, typePari: item.typePari, cote: "", matchDate: m.matchDate });
        newAiEstimates[id] = { p: Math.min(0.97, Math.max(0.03, item.probabilite / 100)), reason: item.justification };
      });
      if (newDraft.length === 0) return;
      setDraft(newDraft); setAiEstimates(newAiEstimates); setMatchesToGenerate([]); setActiveTab("build");
    } catch (e) {} finally { setGenLoading(false); }
  };

  const addMatchToGenerate = () => {
    if (!genForm.equipe1.trim() || !genForm.equipe2.trim()) return;
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
    setDraft([]); setAiEstimates({});
  };

  const setSelStatut = async (id, statut) => { await persist(pronostics.map((p) => (p.id === id ? { ...p, statut } : p))); };
  const removeSel = async (id) => { await persist(pronostics.filter((p) => p.id !== id)); };
  const verdict = (p) => p >= 0.5 ? { label: "Jouable", color: T.win } : p >= 0.25 ? { label: "Risque", color: T.gold } : { label: "Tres risque", color: T.loss };

  if (loading) return <div style={{ minHeight: "100vh", background: T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", color: T.chalkDim }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bgDeep, color: T.chalk, padding: "10px", maxWidth: 500, margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600&display=swap'); *{box-sizing:border-box} body{margin:0} input,select,button{font-size:16px!important}`}</style>

      <div style={{ textAlign: "center", padding: "14px 0 10px" }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Analyseur Foot Pro</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", fontSize: 12, color: T.chalkDim, marginTop: 4 }}>
          <span>Reussite: <b style={{ color: T.gold }}>{stats.rate !== null ? stats.rate + "%" : "-"}</b></span>
          <span>Clotures: <b>{stats.closedCount}</b></span>
        </div>
      </div>

      <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line}` }}>
        {[
          { key: "top", label: "Top Matchs" }, { key: "build", label: "Mon coupon" },
          { key: "gen", label: "Auto" }, { key: "history", label: "Historique" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === "top") fetchTopMatches(); }}
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
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: T.gold }}>Top 3 Matchs du jour</span>
            </div>
            <div style={{ fontSize: 12, color: T.chalkDim, marginBottom: 10 }}>Analyse de 10 championnats (Premier League, Liga, Serie A, Bundesliga, Ligue 1, Portugal, Pays-Bas, Bresil, Ecosse, Belgique)</div>
            {topLoading && <div style={{ textAlign: "center", padding: 20, color: T.chalkDim }}>Analyse des matchs en cours... 30-60 secondes.</div>}
            {topError && <div style={{ color: T.loss, fontSize: 12, marginBottom: 8 }}>{topError}</div>}
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
                <div style={{ fontSize: 12, color: T.gold, marginBottom: 4 }}>Pari conseille: <b>{match.meilleurPari}</b></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 22, color: match.probabilite >= 70 ? T.win : match.probabilite >= 55 ? T.gold : T.loss }}>{match.probabilite}%</span>
                  <span style={{ fontSize: 10, color: T.chalkDim, textTransform: "uppercase" }}>Confiance: {match.niveauConfiance}</span>
                </div>
                {showDetails && <div style={{ fontSize: 11, color: T.chalkDim, marginBottom: 6, fontStyle: "italic" }}>{match.justification}</div>}
                <button onClick={() => addTopMatchToDraft(match)} style={{ width: "100%", padding: 8, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Ajouter ce pronostic</button>
              </div>
            ))}
            {!topLoading && topMatches.length === 0 && !topError && (
              <button onClick={fetchTopMatches} style={{ width: "100%", padding: 14, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Chercher les matchs du jour</button>
            )}
            <button onClick={() => setShowDetails(!showDetails)} style={{ background: "transparent", border: "none", color: T.chalkDim, fontSize: 11, textDecoration: "underline", cursor: "pointer", marginTop: 8 }}>{showDetails ? "Masquer" : "Details"}</button>
          </div>
        </div>
      )}

      {/* MON COUPON */}
      {activeTab === "build" && (
        <>
          {draft.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 }}>Coupon ({draft.length} matchs)</div>
                            {draft.map((sel) => {
                const ev = analysis?.evals.find((e) => e.sel.id === sel.id);
                const aiData = aiEstimates[sel.id];
                return (
                  <div key={sel.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <b>{sel.equipe1} vs {sel.equipe2}</b>
                        <div style={{ color: T.chalkDim, fontSize: 12 }}>{sel.typePari}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {ev && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: ev.p >= 0.5 ? T.win : T.loss, fontSize: 15 }}>{Math.round(ev.p * 100)}%</span>}
                        <button onClick={() => setDraft(draft.filter((x) => x.id !== sel.id))} style={{ background: "transparent", border: "none", color: T.chalkDim, cursor: "pointer" }}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    {aiData && showDetails && aiData.reason && (
                      <div style={{ marginTop: 6, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11, fontStyle: "italic", color: T.chalkDim }}>{aiData.reason}</div>
                    )}
                    {aiData?.h2h && showDetails && (
                      <div style={{ marginTop: 6, padding: 6, background: `${T.gold}11`, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>Confrontations directes :</div>
                        {aiData.h2h.matches?.map((m, i) => (
                          <div key={i} style={{ color: T.chalkDim }}>{m.homeTeam} {m.score} {m.awayTeam}</div>
                        ))}
                        <div style={{ color: T.chalk, marginTop: 3, fontWeight: 600 }}>
                          Bilan : {aiData.h2h.bilan?.homeWins}V domicile - {aiData.h2h.bilan?.draws}N - {aiData.h2h.bilan?.awayWins}V exterieur
                        </div>
                      </div>
                    )}
                    {aiData?.homeAway1 && showDetails && (
                      <div style={{ marginTop: 6, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>{sel.equipe1} a domicile :</div>
                        <div style={{ color: T.chalkDim }}>{aiData.homeAway1.home.won}V/{aiData.homeAway1.home.draw}N/{aiData.homeAway1.home.lost}D - {aiData.homeAway1.home.goalsFor} buts / {aiData.homeAway1.home.goalsAgainst} encaisses</div>
                        <div style={{ color: T.chalkDim, fontSize: 10 }}>Moy: {aiData.homeAway1.home.avgGoalsFor} buts marques/match</div>
                      </div>
                    )}
                    {aiData?.homeAway2 && showDetails && (
                      <div style={{ marginTop: 4, padding: 6, background: T.bgDeep, borderRadius: 4, fontSize: 11 }}>
                        <div style={{ color: T.gold, fontWeight: 600, marginBottom: 3 }}>{sel.equipe2} a l'exterieur :</div>
                        <div style={{ color: T.chalkDim }}>{aiData.homeAway2.away.won}V/{aiData.homeAway2.away.draw}N/{aiData.homeAway2.away.lost}D - {aiData.homeAway2.away.goalsFor} buts / {aiData.homeAway2.away.goalsAgainst} encaisses</div>
                        <div style={{ color: T.chalkDim, fontSize: 10 }}>Moy: {aiData.homeAway2.away.avgGoalsFor} buts marques/match</div>
                      </div>
                    )}
                  </div>
                );
              })}
                      
              {analysis && (
                <div style={{ background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginTop: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 36, color: verdict(analysis.combined).color }}>{Math.round(analysis.combined * 100)}%</div>
                    <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: verdict(analysis.combined).color, color: T.bgDeep, fontWeight: 600, fontSize: 12 }}>{verdict(analysis.combined).label}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <button onClick={() => setShowDetails(!showDetails)} style={{ background: "transparent", border: "none", color: T.chalkDim, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{showDetails ? "Masquer" : "Details"}</button>
                    <button onClick={analyzeWithAI} disabled={aiLoading} style={{ background: T.gold, color: T.bgDeep, border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={14}/> {aiLoading ? "..." : "Analyser"}
                    </button>
                  </div>
                  {aiError && <div style={{ color: T.loss, fontSize: 11, marginTop: 6 }}>{aiError}</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 }}>Ajouter un match</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input placeholder="Equipe 1" value={form.equipe1} onChange={(e) => setForm({ ...form, equipe1: e.target.value })} style={inputStyle()} />
              <span style={{ color: T.chalkDim, fontWeight: 600 }}>VS</span>
              <input placeholder="Equipe 2" value={form.equipe2} onChange={(e) => setForm({ ...form, equipe2: e.target.value })} style={inputStyle()} />
            </div>
            <select value={form.typePari} onChange={(e) => setForm({ ...form, typePari: e.target.value })} style={{ ...inputStyle(), width: "100%", marginBottom: 8 }}>
              {TYPES_PARI.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addToDraft} style={{ width: "100%", padding: 12, background: "transparent", border: `2px dashed ${T.line}`, color: T.gold, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={16}/> Ajouter
            </button>
          </div>

          {draft.length > 0 && (
            <button onClick={saveCoupon} style={{ width: "100%", padding: 14, background: T.win, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 20 }}>Enregistrer</button>
          )}
        </>
      )}

      {/* GENERATION AUTO */}
      {activeTab === "gen" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 }}>Generation automatique</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input placeholder="Equipe 1" value={genForm.equipe1} onChange={(e) => setGenForm({ ...genForm, equipe1: e.target.value })} style={inputStyle()} />
            <input placeholder="Equipe 2" value={genForm.equipe2} onChange={(e) => setGenForm({ ...genForm, equipe2: e.target.value })} style={inputStyle()} />
          </div>
          <button onClick={addMatchToGenerate} style={{ width: "100%", padding: 10, marginBottom: 8, background: "transparent", border: `2px dashed ${T.line}`, color: T.gold, borderRadius: 6, cursor: "pointer" }}><Plus size={14}/> Ajouter</button>
          {matchesToGenerate.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: T.bgDeep, borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
              <span>{m.equipe1} vs {m.equipe2}</span>
              <button onClick={() => setMatchesToGenerate(matchesToGenerate.filter((x) => x.id !== m.id))} style={{ background: "transparent", border: "none", color: T.chalkDim }}><Trash2 size={12}/></button>
            </div>
          ))}
          <button onClick={generateAutoCoupon} disabled={matchesToGenerate.length === 0 || genLoading} style={{ width: "100%", padding: 12, background: T.gold, color: T.bgDeep, border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", opacity: matchesToGenerate.length === 0 ? 0.5 : 1 }}>
            {genLoading ? "Generation..." : "Generer mon coupon"}
          </button>
        </div>
      )}

      {/* HISTORIQUE */}
      {activeTab === "history" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 }}>Historique</div>
          {coupons.length === 0 && <div style={{ textAlign: "center", color: T.chalkDim, padding: 20 }}>Aucun coupon</div>}
          {coupons.map((group) => {
            const allDone = group.every((p) => p.statut !== "en_attente");
            const won = allDone && group.every((p) => p.statut === "gagne");
            return (
              <div key={group[0].couponId || group[0].id} style={{ border: `1px solid ${!allDone ? T.line : won ? T.win : T.loss}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: T.chalkDim }}>
                  <span>{new Date(group[0].date).toLocaleDateString("fr-FR")}</span>
                  <span style={{ color: !allDone ? T.gold : won ? T.win : T.loss, fontWeight: 600 }}>{!allDone ? "En attente" : won ? "Gagne" : "Perdu"}</span>
                </div>
                {group.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                    <span style={{ flex: 1 }}>{p.equipe1} vs {p.equipe2} - {p.typePari}</span>
                    {p.statut === "en_attente" ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setSelStatut(p.id, "gagne")} style={iconBtn(T.win)}><Check size={12}/></button>
                        <button onClick={() => setSelStatut(p.id, "perdu")} style={iconBtn(T.loss)}><X size={12}/></button>
                      </div>
                    ) : (
                      <span style={{ color: p.statut === "gagne" ? T.win : T.loss, fontWeight: 600 }}>{p.statut === "gagne" ? "V" : "X"}</span>
                    )}
                    <button onClick={() => removeSel(p.id)} style={{ background: "transparent", border: "none", color: T.chalkDim, marginLeft: 6 }}><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function inputStyle() {
  return { background: "#0B1F16", border: "1px solid #1F3D2C", borderRadius: 6, padding: "10px", color: "#E9ECE3", fontSize: 14, width: "100%" };
}

function iconBtn(color) {
  return { background: "transparent", border: `1px solid ${color}`, borderRadius: 4, color, cursor: "pointer", padding: "2px 6px" };
}