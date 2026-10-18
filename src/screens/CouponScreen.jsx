import React from "react";
import { CircleHelp, ClipboardList, Eye, EyeOff, House, MapPin, PencilLine, Plus, Save, Trash2, TrendingUp } from "lucide-react";
import BetPicker from "../BetPicker";
import TeamInput from "../TeamInput";
import { REFUND_WHEN, canonicalLabel } from "../betTypes";
import { confidenceLabel, crossLeagueNote, crossTotalNote, refundNote } from "../estimates";
import { formatDate, nameDiffers } from "../format";
import { Badge, Btn, Card, ChipBtn, EmptyState, IconBtn, Note, ProbBar, SectionTitle, Spinner, probTone } from "../ui";

function verdict(p) {
  return p >= 0.5 ? { label: "Jouable", tone: "win" } : p >= 0.25 ? { label: "Risqué", tone: "gold" } : { label: "Très risqué", tone: "loss" };
}

const pct = (p) => `${Math.round(p * 100)} %`;

// Noms à afficher : ceux reconnus par le serveur si le pari a été analysé (« Paris SG »), sinon la saisie (« psg »).
function shownNames(sel, ai) {
  const detailed = Boolean(ai) && typeof ai.p === "number";
  return [(detailed && ai.equipe1) || sel.equipe1, (detailed && ai.equipe2) || sel.equipe2];
}

function HomeAwayBox({ title, record }) {
  return (
    <div className="sel__box">
      <p className="sel__box-title">{title}</p>
      <p className="sel__box-line">{record.won}V/{record.draw}N/{record.lost}D - {record.goalsFor} buts / {record.goalsAgainst} encaissés</p>
      <p className="sel__box-line">Moy : {record.avgGoalsFor} buts marqués/match</p>
    </div>
  );
}

// Une sélection du coupon : noms, pari, pourcentage, et (avec « Détails ») le texte de l'analyse.
function SelectionRow({ sel, ev, ai, showDetails, onRemove }) {
  const detailed = Boolean(ai) && typeof ai.p === "number";
  // La saisie d'origine est rappelée quand le nom reconnu en est éloigné.
  const [name1, name2] = shownNames(sel, ai);
  const typedDiffers = detailed && (nameDiffers(sel.equipe1, name1) || nameDiffers(sel.equipe2, name2));
  const headline = detailed ? [ai.competition, formatDate(ai.date)].filter(Boolean).join(" · ") : "";
  const analysed = Boolean(ev && !ev.failed && ev.source === "analyse");
  const tone = !ev ? null : ev.failed ? "gold" : analysed ? probTone(ev.p * 100) : "dim";
  const bet = canonicalLabel(sel.typePari);
  // Pari à ligne entière : la mise est rendue quand le résultat tombe pile sur la ligne.
  const refundRule = REFUND_WHEN[bet];
  return (
    <div className={`sel ${tone ? `tone-${tone}` : ""}`} style={tone === "dim" ? { "--tone": "var(--line-strong)" } : undefined}>
      <div className="sel__top">
        <div className="sel__info">
          <b className="sel__names">{name1} vs {name2}</b>
          <p className="sel__bet">{bet}</p>
          {headline ? <p className="sel__small">{headline}</p> : null}
          {typedDiffers ? <p className="sel__small">{`Saisi : ${sel.equipe1} – ${sel.equipe2}`}</p> : null}
          {ev && !ev.failed && ev.source === "historique" ? <p className="sel__small">{`Estimation d'après votre historique (${ev.n} paris), pas encore analysé`}</p> : null}
          {ev && !ev.failed && ev.source === "general" ? <p className="sel__small">Moyenne générale de ce pari, pas encore analysé</p> : null}
        </div>
        <div className="sel__right">
          {ev ? (
            ev.failed ? (
              <span className="sel__prob tone-gold" role="img" aria-label="Analyse impossible" title={ev.message}>?</span>
            ) : (
              <span className={analysed ? "sel__prob" : "sel__prob sel__prob--dim"}>{analysed ? "" : "~"}{pct(ev.p)}</span>
            )
          ) : null}
          <IconBtn icon={Trash2} label={`Retirer ${name1} vs ${name2}`} onClick={onRemove} />
        </div>
      </div>
      {ev && !ev.failed ? <ProbBar value={ev.p} tone={analysed ? tone : "dim"} height={5} /> : null}
      {ev && ev.failed ? <Note>{ev.message}</Note> : null}
      {detailed && ai.crossLeague ? <Note>{crossLeagueNote(ai.crossLeague)}</Note> : null}
      {refundRule ? <Note tone="info">{ai && ai.refund ? refundNote(ai.refund) : `Remboursé si ${refundRule}.`}</Note> : null}
      {detailed && showDetails && ai.reason ? <p className="sel__reason">{ai.reason}</p> : null}
      {detailed && showDetails && ai.vigilance ? <Note>À surveiller : {ai.vigilance}</Note> : null}
      {detailed && showDetails && ai.confidence ? <p className="sel__confidence">Confiance : {confidenceLabel(ai.confidence)}</p> : null}
      {ai && ai.h2h && showDetails ? (
        <div className="sel__box sel__box--gold">
          <p className="sel__box-title">Confrontations directes :</p>
          {ai.h2h.matches && ai.h2h.matches.map((m, i) => <p key={i} className="sel__box-line">{m.homeTeam} {m.score} {m.awayTeam}</p>)}
          <p className="sel__box-line sel__box-line--strong">
            Bilan : {ai.h2h.bilan && ai.h2h.bilan.homeWins} V domicile - {ai.h2h.bilan && ai.h2h.bilan.draws} N - {ai.h2h.bilan && ai.h2h.bilan.awayWins} V extérieur
          </p>
        </div>
      ) : null}
      {ai && ai.homeAway1 && ai.homeAway1.home && showDetails ? <HomeAwayBox title={`${name1} à domicile :`} record={ai.homeAway1.home} /> : null}
      {ai && ai.homeAway2 && ai.homeAway2.away && showDetails ? <HomeAwayBox title={`${name2} à l'extérieur :`} record={ai.homeAway2.away} /> : null}
    </div>
  );
}

function Total({ c, analysis }) {
  const { draft, showDetails, aiLoading, aiPhase, aiNotice, aiError } = c;
  const indicative = analysis.pending > 0;
  const v = verdict(analysis.combined);
  const tone = indicative ? "dim" : v.tone;
  const [weak1, weak2] = shownNames(analysis.weakest.sel, c.aiEstimates[analysis.weakest.sel.id]);
  return (
    <div className={`total tone-${tone}`}>
      <div className="total__top">
        <div>
          <p className="total__label">Probabilité combinée</p>
          <p className="total__prob">{indicative ? "~" : ""}{pct(analysis.combined)}</p>
        </div>
        {indicative ? <Badge tone="dim" icon={CircleHelp}>Estimation indicative</Badge> : <Badge solid tone={v.tone}>{v.label}</Badge>}
      </div>
      <ProbBar value={analysis.combined} tone={tone} height={8} />
      {!indicative ? (
        <p className="total__text">
          Cote équitable estimée : <b className="total__fair">{(1 / analysis.combined).toFixed(2)}</b> (sans marge de bookmaker : les cotes réelles seront plus basses)
        </p>
      ) : null}
      {indicative ? (
        <Note>{analysis.pending > 1 ? `${analysis.pending} sélections n'ont` : "1 sélection n'a"} pas d'analyse chiffrée : le pourcentage est indicatif. Appuyez sur « Analyser ».</Note>
      ) : null}
      {analysis.sameMatch ? <Note>Plusieurs paris portent sur le même match : ils sont liés entre eux, le pourcentage combiné peut être inexact.</Note> : null}
      {analysis.crossCount > 0 ? <Note>{crossTotalNote(analysis.crossCount)}</Note> : null}
      {!indicative && draft.length > 1 && analysis.combinedWithout !== null ? (
        <p className="total__text">
          Sélection la plus fragile : {weak1} vs {weak2} ({pct(analysis.weakest.p)}). Sans elle : {pct(analysis.combinedWithout)}.
        </p>
      ) : null}
      <div className="total__actions">
        <ChipBtn icon={showDetails ? EyeOff : Eye} onClick={c.toggleDetails}>{showDetails ? "Masquer" : "Détails"}</ChipBtn>
        <Btn icon={TrendingUp} compact onClick={c.analyzeWithAI} disabled={aiLoading}>{aiLoading ? "Analyse…" : "Analyser"}</Btn>
      </div>
      {aiLoading ? (
        <div className="progress" role="status">
          <Spinner />
          <span>
            {aiPhase === "ia"
              ? "Résultat du modèle statistique affiché : la relecture par l'IA est en cours (quelques secondes), les pourcentages peuvent bouger de quelques points."
              : "Analyse en cours : jusqu'à une minute pour un grand coupon."}
          </span>
        </div>
      ) : null}
      {aiNotice ? <Note>{aiNotice}</Note> : null}
      {aiError ? <Note tone="bad">{aiError}</Note> : null}
    </div>
  );
}

// Onglet « Mon coupon » : ajouter des matchs, analyser le coupon, l'enregistrer. Sur grand écran, le formulaire est à gauche et le coupon à droite.
export default function CouponScreen({ c }) {
  const { draft, form, catalog, analysis } = c;
  return (
    <div className="coupon-layout">
      <Card className="coupon-layout__form">
        <SectionTitle icon={PencilLine}>Ajouter un match</SectionTitle>
        <TeamInput
          label="Équipe 1 (à domicile)"
          placeholder="Nom du club"
          icon={House}
          value={form.equipe1}
          onChange={(v) => c.setForm((f) => ({ ...f, equipe1: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <TeamInput
          label="Équipe 2 (à l'extérieur)"
          placeholder="Nom du club"
          icon={MapPin}
          value={form.equipe2}
          onChange={(v) => c.setForm((f) => ({ ...f, equipe2: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <BetPicker value={form.typePari} onChange={(v) => c.setForm((f) => ({ ...f, typePari: v }))} />
        <Btn kind={draft.length > 0 ? "secondary" : "primary"} icon={Plus} onClick={c.addToDraft}>Ajouter</Btn>
        <Note tone="info">
          L'équipe 1 reçoit (domicile), l'équipe 2 se déplace. Les deux clubs peuvent venir de championnats différents (Ligue des champions, par exemple) : l'estimation est alors moins précise.
        </Note>
      </Card>

      <div className="coupon-layout__main">
        {draft.length > 0 ? (
          <>
            <Card>
              <SectionTitle icon={ClipboardList}>{`Coupon (${draft.length} ${draft.length > 1 ? "matchs" : "match"})`}</SectionTitle>
              {draft.map((sel) => (
                <SelectionRow
                  key={sel.id}
                  sel={sel}
                  ev={analysis ? analysis.evals.find((e) => e.sel.id === sel.id) : undefined}
                  ai={c.aiEstimates[sel.id]}
                  showDetails={c.showDetails}
                  onRemove={() => c.removeFromDraft(sel.id)}
                />
              ))}
              {analysis ? <Total c={c} analysis={analysis} /> : null}
            </Card>
            <Btn kind="success" icon={Save} onClick={c.saveCoupon}>Enregistrer</Btn>
          </>
        ) : (
          <Card className="coupon-empty">
            <EmptyState icon={ClipboardList} title="Votre coupon est vide">
              Ajoutez un match avec le formulaire, ou choisissez un pari parmi les meilleurs matchs à venir.
            </EmptyState>
          </Card>
        )}
      </div>
    </div>
  );
}
