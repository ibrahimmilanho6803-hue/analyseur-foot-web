import React, { useEffect } from "react";
import { CircleCheck, ClipboardList, Clock, Cpu, Target, Zap } from "lucide-react";
import AutoScreen from "./screens/AutoScreen";
import CouponScreen from "./screens/CouponScreen";
import HistoryScreen from "./screens/HistoryScreen";
import TopScreen from "./screens/TopScreen";
import { Icon, Spinner } from "./ui";
import { useAnalyseur } from "./useAnalyseur";

// Fonctions utilitaires réexportées : les tests (et d'éventuels autres écrans) les importent d'ici.
export { callApi } from "./api";
export { asCross, asRefund, asTarget, awaitsReview, crossLeagueNote, crossTotalNote, estimateProb, estimatesForChunk, fromTopMatch, mergeEstimates, refundNote, targetNote, targetShortfall, toEstimate } from "./estimates";
export { useTeamCatalog } from "./useTeamCatalog";

// Mêmes termes que dans l'application mobile.
export const DISCLAIMER =
  "Probabilités estimées par un modèle statistique relu par l'IA : ce ne sont jamais des certitudes. Les cotes affichées sont des cotes équitables estimées, sans marge de bookmaker. Jouez avec modération.";

const LOGO = `${process.env.PUBLIC_URL || ""}/logo192.png`;

const TABS = [
  { key: "top", label: "Top Matchs", icon: Zap },
  { key: "build", label: "Mon coupon", icon: ClipboardList },
  { key: "gen", label: "Auto", icon: Cpu },
  { key: "history", label: "Historique", icon: Clock },
];

const SCREENS = { top: TopScreen, build: CouponScreen, gen: AutoScreen, history: HistoryScreen };

// Le site entier : en-tête, navigation, écran de l'onglet actif.
export default function AnalyseurCoupon() {
  const c = useAnalyseur();
  const { activeTab, loading, stats } = c;

  // Chaque onglet s'ouvre en haut de page (sur téléphone, la barre d'onglets est fixe : la page reste sinon là où elle était).
  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen" role="status">
          <img className="loading-screen__logo" src={LOGO} alt="" width="72" height="72" />
          <Spinner large />
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

  const Screen = SCREENS[activeTab] || CouponScreen;
  return (
    <div className="page">
      <div className="app">
        <header className="app-header">
          <div className="brand">
            <img className="brand__logo" src={LOGO} alt="" width="58" height="58" />
            <div>
              <h1 className="brand__name">Analyseur Foot Pro</h1>
              <p className="brand__tag">Pronostics football : statistiques et IA</p>
            </div>
          </div>
          <div className="stats">
            <div className="stat stat--gold">
              <Icon icon={Target} size={16} />
              <span>
                Réussite : <b>{stats.rate !== null ? `${stats.rate} %` : "-"}</b>
              </span>
            </div>
            <div className="stat">
              <Icon icon={CircleCheck} size={16} />
              <span>
                Clôturés : <b>{stats.closedCount}</b>
              </span>
            </div>
          </div>
        </header>

        <nav className="nav" aria-label="Sections">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" className="nav__item" aria-current={tab.key === activeTab ? "page" : undefined} onClick={() => c.openTab(tab.key)}>
              <span className="nav__icon">
                <Icon icon={tab.icon} size={21} />
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <main className="screen">
          <Screen c={c} />
        </main>

        <p className="disclaimer">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
