import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import BetTypePicker from "../components/BetTypePicker";
import TeamInput from "../components/TeamInput";
import { canonicalLabel, REFUND_WHEN } from "../betTypes";
import { crossLeagueNote, refundNote } from "../estimates";
import { confidenceLabel, formatDate, nameDiffers } from "../format";
import type { Controller, CouponAnalysis, Evaluation } from "../hooks/useAnalyseur";
import { F, RD, SP, T, alpha, probTone } from "../theme";
import type { Estimate, HomeAway, Selection } from "../types";
import { Badge, Bold, Btn, Card, IconBtn, LinkBtn, Note, ProbBar, SectionTitle, Txt } from "../ui";

function verdict(p: number): { label: string; color: string } {
  return p >= 0.5 ? { label: "Jouable", color: T.win } : p >= 0.25 ? { label: "Risqué", color: T.gold } : { label: "Très risqué", color: T.loss };
}

const pct = (p: number) => `${Math.round(p * 100)} %`;

const crossTotalNote = (count: number): string =>
  count > 1
    ? `${count} sélections opposent des clubs de championnats différents : leurs estimations sont moins précises, le pourcentage combiné aussi.`
    : "1 sélection oppose des clubs de championnats différents : son estimation est moins précise, le pourcentage combiné aussi.";

function HomeAwayBox({ title, record }: { title: string; record: NonNullable<HomeAway["home"]> }) {
  return (
    <View style={s.detail}>
      <Text style={s.detailTitle}>{title}</Text>
      <Txt style={s.detailText}>
        {record.won}V/{record.draw}N/{record.lost}D - {record.goalsFor} buts / {record.goalsAgainst} encaissés
      </Txt>
      <Txt style={s.detailSmall}>Moy : {record.avgGoalsFor} buts marqués/match</Txt>
    </View>
  );
}

// Noms à afficher : ceux reconnus par le serveur si le pari a été analysé (« Paris SG »), sinon la saisie (« psg »).
function shownNames(sel: Selection, ai?: Estimate): [string, string] {
  const detailed = Boolean(ai) && typeof ai?.p === "number";
  return [(detailed && ai?.equipe1) || sel.equipe1, (detailed && ai?.equipe2) || sel.equipe2];
}

// Une sélection du coupon : noms, pari, pourcentage, et (avec « Détails ») le texte de l'analyse.
function SelectionRow({ sel, ev, ai, showDetails, onRemove }: { sel: Selection; ev?: Evaluation; ai?: Estimate; showDetails: boolean; onRemove: () => void }) {
  const detailed = Boolean(ai) && typeof ai?.p === "number";
  // La saisie d'origine est rappelée quand le nom reconnu en est éloigné.
  const [name1, name2] = shownNames(sel, ai);
  const typedDiffers = detailed && (nameDiffers(sel.equipe1, name1) || nameDiffers(sel.equipe2, name2));
  const headline = [ai?.competition, formatDate(ai?.date)].filter(Boolean).join(" · ");
  const analysed = Boolean(ev && !ev.failed && ev.source === "analyse");
  const tone = !ev ? T.line : ev.failed ? T.gold : ev.source !== "analyse" ? T.lineStrong : probTone(ev.p * 100);
  // Pari à ligne entière : la mise est rendue quand le résultat tombe pile sur la ligne.
  const refundRule = REFUND_WHEN[canonicalLabel(sel.typePari)];
  return (
    <View style={[s.sel, { borderLeftColor: tone }]}>
      <View style={s.selTop}>
        <View style={s.selInfo}>
          <Txt style={s.selNames}>
            {name1} vs {name2}
          </Txt>
          <Txt style={s.selBet}>{sel.typePari}</Txt>
          {detailed && headline ? <Txt style={s.selSmall}>{headline}</Txt> : null}
          {typedDiffers ? <Txt style={s.selSmall}>{`Saisi : ${sel.equipe1} – ${sel.equipe2}`}</Txt> : null}
          {ev && !ev.failed && ev.source === "historique" ? <Txt style={s.selSmall}>{`Estimation d'après votre historique (${ev.n} paris), pas encore analysé`}</Txt> : null}
          {ev && !ev.failed && ev.source === "general" ? <Txt style={s.selSmall}>Moyenne générale de ce pari, pas encore analysé</Txt> : null}
        </View>
        <View style={s.selRight}>
          {ev ? (
            ev.failed ? (
              <Text aria-label="Analyse impossible" style={[s.selProb, { color: T.gold }]}>
                ?
              </Text>
            ) : (
              <Text style={[s.selProb, { color: ev.source !== "analyse" ? T.chalkDim : probTone(ev.p * 100) }]}>
                {ev.source !== "analyse" ? "~" : ""}
                {pct(ev.p)}
              </Text>
            )
          ) : null}
          <IconBtn icon="trash-2" ariaLabel={`Retirer ${name1} vs ${name2}`} onPress={onRemove} />
        </View>
      </View>
      {ev && !ev.failed ? <ProbBar value={ev.p} color={analysed ? tone : T.lineStrong} height={5} style={s.selBar} /> : null}
      {ev && ev.failed ? <Note>{ev.message}</Note> : null}
      {detailed && ai?.crossLeague ? <Note>{crossLeagueNote(ai.crossLeague)}</Note> : null}
      {refundRule ? <Note tone="info">{ai?.refund ? refundNote(ai.refund) : `Remboursé si ${refundRule}.`}</Note> : null}
      {detailed && showDetails && ai?.reason ? <Txt style={s.reason}>{ai.reason}</Txt> : null}
      {detailed && showDetails && ai?.vigilance ? <Note>{`À surveiller : ${ai.vigilance}`}</Note> : null}
      {detailed && showDetails && ai?.confidence ? <Txt style={s.confidence}>{`Confiance : ${confidenceLabel(ai.confidence)}`}</Txt> : null}
      {ai?.h2h && showDetails ? (
        <View style={s.h2h}>
          <Text style={s.detailTitle}>Confrontations directes :</Text>
          {ai.h2h.matches?.map((m, i) => (
            <Txt key={i} style={s.detailSmall}>
              {m.homeTeam} {m.score} {m.awayTeam}
            </Txt>
          ))}
          <Txt style={s.h2hBilan}>
            Bilan : {ai.h2h.bilan?.homeWins} V domicile - {ai.h2h.bilan?.draws} N - {ai.h2h.bilan?.awayWins} V extérieur
          </Txt>
        </View>
      ) : null}
      {ai?.homeAway1?.home && showDetails ? <HomeAwayBox title={`${name1} à domicile :`} record={ai.homeAway1.home} /> : null}
      {ai?.homeAway2?.away && showDetails ? <HomeAwayBox title={`${name2} à l'extérieur :`} record={ai.homeAway2.away} /> : null}
    </View>
  );
}

function Total({ c, analysis }: { c: Controller; analysis: CouponAnalysis }) {
  const { draft, showDetails, aiLoading, aiPhase, aiNotice, aiError } = c;
  const indicative = analysis.pending > 0;
  const v = verdict(analysis.combined);
  const color = indicative ? T.chalkDim : v.color;
  const [weak1, weak2] = shownNames(analysis.weakest.sel, c.aiEstimates[analysis.weakest.sel.id]);
  // Sélections dont les deux clubs viennent de championnats différents : leur estimation est moins précise, et le total aussi.
  const crossCount = analysis.evals.filter((e) => !e.failed && e.source === "analyse" && c.aiEstimates[e.sel.id]?.crossLeague).length;
  return (
    <View style={s.total}>
      <View style={s.totalTop}>
        <View style={s.totalMain}>
          <Txt style={s.totalLabel}>Probabilité combinée</Txt>
          <Text style={[s.totalProb, { color }]}>
            {indicative ? "~" : ""}
            {pct(analysis.combined)}
          </Text>
        </View>
        {indicative ? <Badge label="Estimation indicative" tone="neutral" icon="help-circle" /> : <Badge label={v.label} solid tone={v.label === "Jouable" ? "win" : v.label === "Risqué" ? "gold" : "loss"} />}
      </View>
      <ProbBar value={analysis.combined} color={color} height={8} style={s.totalBar} />
      {!indicative ? (
        <Txt style={s.fairOdds}>
          Cote équitable estimée : <Bold style={s.fairValue}>{(1 / analysis.combined).toFixed(2)}</Bold> (sans marge de bookmaker : les cotes réelles seront plus basses)
        </Txt>
      ) : null}
      {indicative ? (
        <Note>{analysis.pending > 1 ? `${analysis.pending} sélections n'ont` : "1 sélection n'a"} pas d'analyse chiffrée : le pourcentage est indicatif. Appuyez sur « Analyser ».</Note>
      ) : null}
      {analysis.sameMatch ? <Note>Plusieurs paris portent sur le même match : ils sont liés entre eux, le pourcentage combiné peut être inexact.</Note> : null}
      {crossCount > 0 ? <Note>{crossTotalNote(crossCount)}</Note> : null}
      {!indicative && draft.length > 1 && analysis.combinedWithout !== null ? (
        <Txt style={s.fragile}>
          Sélection la plus fragile : {weak1} vs {weak2} ({pct(analysis.weakest.p)}). Sans elle : {pct(analysis.combinedWithout)}.
        </Txt>
      ) : null}
      <View style={s.totalActions}>
        <LinkBtn label={showDetails ? "Masquer" : "Détails"} icon={showDetails ? "eye-off" : "eye"} onPress={c.toggleDetails} />
        <View style={s.analyzeWrap}>
          <Btn label={aiLoading ? "Analyse…" : "Analyser"} icon="trending-up" onPress={() => void c.analyzeWithAI()} disabled={aiLoading} compact />
        </View>
      </View>
      {aiLoading ? (
        <View style={s.progress}>
          <ActivityIndicator color={T.gold} size="small" />
          <Txt style={s.progressText}>
            {aiPhase === "ia"
              ? "Résultat du modèle statistique affiché : la relecture par l'IA est en cours (quelques secondes), les pourcentages peuvent bouger de quelques points."
              : "Analyse en cours : jusqu'à une minute pour un grand coupon."}
          </Txt>
        </View>
      ) : null}
      {aiNotice ? <Note>{aiNotice}</Note> : null}
      {aiError ? <Note tone="bad">{aiError}</Note> : null}
    </View>
  );
}

// Onglet « Mon coupon » : ajouter des matchs, analyser le coupon, l'enregistrer.
export default function CouponScreen({ c }: { c: Controller }) {
  const { draft, form, catalog, analysis } = c;
  return (
    <>
      <Card>
        <SectionTitle icon="edit-3">Ajouter un match</SectionTitle>
        <TeamInput
          label="Équipe 1 (à domicile)"
          placeholder="Nom du club"
          icon="home"
          value={form.equipe1}
          onChange={(v) => c.setForm((f) => ({ ...f, equipe1: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <TeamInput
          label="Équipe 2 (à l'extérieur)"
          placeholder="Nom du club"
          icon="map-pin"
          value={form.equipe2}
          onChange={(v) => c.setForm((f) => ({ ...f, equipe2: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <BetTypePicker value={form.typePari} onChange={(v) => c.setForm((f) => ({ ...f, typePari: v }))} />
        <Btn label="Ajouter" icon="plus" kind={draft.length > 0 ? "secondary" : "primary"} onPress={c.addToDraft} />
        <Note tone="info">
          L'équipe 1 reçoit (domicile), l'équipe 2 se déplace. Les deux clubs peuvent venir de championnats différents (Ligue des champions, par exemple) : l'estimation est alors moins précise.
        </Note>
      </Card>

      {draft.length > 0 ? (
        <Card>
          <SectionTitle icon="clipboard">{`Coupon (${draft.length} ${draft.length > 1 ? "matchs" : "match"})`}</SectionTitle>
          {draft.map((sel) => (
            <SelectionRow
              key={sel.id}
              sel={sel}
              ev={analysis?.evals.find((e) => e.sel.id === sel.id)}
              ai={c.aiEstimates[sel.id]}
              showDetails={c.showDetails}
              onRemove={() => c.removeFromDraft(sel.id)}
            />
          ))}
          {analysis ? <Total c={c} analysis={analysis} /> : null}
        </Card>
      ) : null}

      {draft.length > 0 ? <Btn label="Enregistrer" icon="save" kind="success" onPress={() => void c.saveCoupon()} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  sel: { backgroundColor: T.raised, borderColor: T.line, borderWidth: 1, borderLeftWidth: 4, borderRadius: RD.md, paddingVertical: SP.md, paddingHorizontal: SP.md, marginBottom: SP.sm },
  selTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SP.sm },
  selInfo: { flex: 1, minWidth: 0 },
  selNames: { fontFamily: F.bodySemi, fontSize: 15, lineHeight: 21 },
  selBet: { color: T.gold, fontFamily: F.bodyMedium, fontSize: 13.5, lineHeight: 19, marginTop: 1 },
  selSmall: { color: T.chalkDim, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  selRight: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: -4, marginRight: -6 },
  selProb: { fontFamily: F.title, fontSize: 22, lineHeight: 28, fontVariant: ["tabular-nums"] },
  selBar: { marginTop: SP.sm },
  reason: { marginTop: SP.sm, padding: SP.sm, backgroundColor: T.bgDeep, borderRadius: 8, fontSize: 12.5, lineHeight: 18, fontStyle: "italic", color: T.chalkDim },
  confidence: { marginTop: SP.sm, fontSize: 12, color: T.chalkDim },
  h2h: { marginTop: SP.sm, padding: SP.sm, backgroundColor: alpha(T.gold, 0.07), borderRadius: 8 },
  h2hBilan: { marginTop: 4, fontFamily: F.bodySemi, fontSize: 12 },
  detail: { marginTop: SP.sm, padding: SP.sm, backgroundColor: T.bgDeep, borderRadius: 8 },
  detailTitle: { fontFamily: F.bodySemi, fontSize: 12, color: T.gold, marginBottom: 3 },
  detailText: { fontSize: 12, lineHeight: 17, color: T.chalkDim },
  detailSmall: { fontSize: 11.5, lineHeight: 16, color: T.chalkDim },
  total: { backgroundColor: T.bgDeep, borderColor: T.lineStrong, borderWidth: 1, borderRadius: RD.md, padding: SP.lg, marginTop: SP.sm },
  totalTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SP.sm },
  totalMain: { flexShrink: 1 },
  totalLabel: { fontFamily: F.bodyMedium, fontSize: 12.5, color: T.chalkDim },
  totalProb: { fontFamily: F.title, fontSize: 46, lineHeight: 54, fontVariant: ["tabular-nums"] },
  totalBar: { marginTop: SP.xs },
  fairOdds: { fontSize: 12.5, lineHeight: 18, color: T.chalkDim, marginTop: SP.md },
  fairValue: { fontFamily: F.mono, fontSize: 14, color: T.gold },
  fragile: { fontSize: 12.5, lineHeight: 18, color: T.chalkDim, marginTop: SP.md },
  totalActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SP.lg },
  analyzeWrap: { minWidth: 150 },
  progress: { flexDirection: "row", alignItems: "flex-start", gap: SP.sm, marginTop: SP.md },
  progressText: { flex: 1, color: T.chalkDim, fontSize: 12, lineHeight: 17 },
});
