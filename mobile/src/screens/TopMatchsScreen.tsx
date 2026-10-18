import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { asCross, asRefund, crossLeagueNote, refundNote } from "../estimates";
import { confidenceLabel, formatDate } from "../format";
import type { Controller } from "../hooks/useAnalyseur";
import { F, RD, SP, T, alpha, probTone } from "../theme";
import type { TopMatch } from "../types";
import { Btn, Card, LinkBtn, Meter, Note, ProbBar, ScreenTitle, Tile, Txt } from "../ui";

const levelOf = (confidence?: string): 0 | 1 | 2 | 3 => (confidence === "eleve" ? 3 : confidence === "moyen" ? 2 : confidence === "faible" ? 1 : 0);

function MatchCard({ match, first, showDetails, added, onAdd }: { match: TopMatch; first: boolean; showDetails: boolean; added: boolean; onAdd: () => void }) {
  const cross = asCross(match.comparaisonEntreChampionnats); // clubs de championnats différents (Ligue des champions…)
  const refund = asRefund(match.remboursement);
  const color = probTone(match.probabilite);
  return (
    <Card accent={first} style={s.match}>
      <View style={s.matchHead}>
        <View style={s.compWrap}>
          {first ? <Feather name="star" size={15} color={T.gold} /> : null}
          {match.competition ? (
            <Text style={s.chip} numberOfLines={1}>
              {match.competition}
            </Text>
          ) : null}
        </View>
        <Text style={s.date}>{formatDate(match.date)}</Text>
      </View>

      <Txt style={s.teams}>
        {match.homeTeam} vs {match.awayTeam}
      </Txt>

      <View style={s.pick}>
        <View style={s.pickMain}>
          <Txt style={s.caption}>Pari conseillé</Txt>
          <Txt style={s.pickName}>{match.meilleurPari}</Txt>
        </View>
        {typeof match.coteEstimee === "number" ? (
          <View style={s.odds}>
            <Txt style={s.caption}>Cote estimée</Txt>
            <Text style={s.oddsValue}>{match.coteEstimee.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.probRow}>
        <Text style={[s.prob, { color }]}>{match.probabilite} %</Text>
        <View style={s.probSide}>
          <ProbBar value={match.probabilite / 100} color={color} height={8} />
          <View style={s.confRow}>
            <Meter level={levelOf(match.niveauConfiance)} color={color} />
            <Txt style={s.conf}>Confiance : {confidenceLabel(match.niveauConfiance)}</Txt>
          </View>
        </View>
      </View>

      {cross ? <Note>{crossLeagueNote(cross)}</Note> : null}
      {refund ? <Note tone="info">{refundNote(refund)}</Note> : null}
      {showDetails && match.justification ? <Txt style={s.reason}>{match.justification}</Txt> : null}
      {showDetails && match.vigilance ? <Note>À surveiller : {match.vigilance}</Note> : null}
      <Btn label={added ? "Déjà dans le coupon" : "Ajouter ce pronostic"} icon={added ? "check" : "plus"} kind={added ? "secondary" : "primary"} onPress={onAdd} disabled={added} compact style={s.add} />
    </Card>
  );
}

// Onglet « Top Matchs » : les meilleurs matchs à venir, choisis et analysés par le serveur.
export default function TopMatchsScreen({ c }: { c: Controller }) {
  const { topMatches, topMeta, topLoading, topError, topAt, showDetails } = c;
  const iaDown = Boolean(topMeta && topMeta.ia && (topMeta.ia.statut === "indisponible" || topMeta.ia.statut === "partielle"));
  const iaOff = Boolean(topMeta && topMeta.ia && topMeta.ia.statut === "desactivee");
  const nb = topMeta ? topMeta.nbChampionnats : null;
  const nbCups = topMeta && topMeta.nbCoupes ? topMeta.nbCoupes : 0;
  const scope = nb ? `${nb} championnat${nb > 1 ? "s" : ""}${nbCups > 0 ? ` et ${nbCups} coupe${nbCups > 1 ? "s" : ""} d'Europe` : ""}` : "";
  const subtitle = nb ? `Analyse de ${scope}, matchs des ${topMeta ? topMeta.fenetreHeures : ""} prochaines heures.` : "Analyse des championnats couverts par le serveur.";

  return (
    <View>
      <ScreenTitle icon="zap" title="Top 3 Matchs à venir" subtitle={subtitle} />

      <View style={s.tools}>
        {!topLoading && (topAt > 0 || topError) ? <LinkBtn label="Actualiser" icon="refresh-cw" onPress={() => void c.fetchTopMatches()} color={T.gold} /> : null}
        {topMatches.length > 0 ? <LinkBtn label={showDetails ? "Masquer" : "Détails"} icon={showDetails ? "eye-off" : "eye"} onPress={c.toggleDetails} /> : null}
      </View>

      {topLoading ? (
        <Card>
          <View style={s.loading} role="progressbar" aria-busy>
            <ActivityIndicator color={T.gold} size="large" />
            <Txt style={s.loadingText}>Analyse des matchs en cours… (jusqu'à une minute)</Txt>
          </View>
        </Card>
      ) : null}
      {topError ? <Note tone="bad">{topError}</Note> : null}
      {!topLoading && topMeta && topMeta.message ? <Note>{topMeta.message}</Note> : null}
      {!topLoading && iaDown ? <Note>La relecture par l'IA n'a pas pu être faite pour tous les matchs : ces probabilités viennent du modèle statistique seul.</Note> : null}
      {!topLoading && iaOff ? <Note>La relecture par l'IA est désactivée sur le serveur : probabilités du modèle statistique seul.</Note> : null}
      {!topLoading && topMeta && topMeta.perime ? <Note>Sélection précédente conservée : les données n'ont pas pu être actualisées.</Note> : null}
      {!topLoading && topMeta && topMeta.complet === false ? <Note>Certains championnats sont encore en cours de chargement : la sélection peut évoluer dans quelques minutes.</Note> : null}
      {!topLoading && topMeta && topMeta.avertissementDonnees ? <Note>{topMeta.avertissementDonnees}</Note> : null}

      {!topLoading && topMatches.length > 0 && topMeta ? (
        <Card style={s.summary}>
          <View style={s.tiles}>
            <Tile label="Cote combinée estimée">
              <Text style={[s.tileValue, { color: T.gold }]}>{topMeta.coteTotale}</Text>
            </Tile>
            <Tile label="Probabilité combinée">
              <Text style={s.tileValue}>{topMeta.probabiliteCombinee} %</Text>
            </Tile>
          </View>
          {topMeta.avertissement ? <Note tone="info">{topMeta.avertissement}</Note> : null}
        </Card>
      ) : null}

      {topMatches.map((match, i) => (
        <MatchCard key={String(match.id ?? i)} match={match} first={i === 0} showDetails={showDetails} added={c.isInDraft(match)} onAdd={() => c.addTopMatchToDraft(match)} />
      ))}

      {!topLoading && topAt === 0 && topMatches.length === 0 && !topError ? <Btn label="Chercher les meilleurs matchs" icon="search" onPress={() => void c.fetchTopMatches()} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tools: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, marginBottom: SP.sm },
  loading: { alignItems: "center", gap: SP.md, paddingVertical: SP.lg },
  loadingText: { color: T.chalkDim, fontSize: 13, textAlign: "center" },
  summary: { marginTop: SP.sm },
  tiles: { flexDirection: "row", gap: SP.sm },
  tileValue: { fontFamily: F.title, fontSize: 30, lineHeight: 36, color: T.chalk, fontVariant: ["tabular-nums"] },
  match: { marginTop: SP.xs },
  matchHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SP.sm, marginBottom: SP.md },
  compWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  chip: { fontFamily: F.bodyMedium, fontSize: 11.5, color: T.chalk, backgroundColor: T.raised, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RD.pill, overflow: "hidden", flexShrink: 1 },
  date: { fontFamily: F.body, fontSize: 11.5, color: T.chalkDim },
  teams: { fontFamily: F.bodySemi, fontSize: 18, lineHeight: 24, marginBottom: SP.md },
  pick: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: alpha(T.gold, 0.09), borderColor: alpha(T.gold, 0.3), borderWidth: 1, borderRadius: RD.md, padding: SP.md },
  pickMain: { flex: 1, minWidth: 0, gap: 2 },
  caption: { fontFamily: F.body, fontSize: 12, color: T.chalkDim },
  pickName: { fontFamily: F.bodySemi, fontSize: 16, lineHeight: 22, color: T.gold },
  odds: { alignItems: "flex-end", gap: 2 },
  oddsValue: { fontFamily: F.mono, fontSize: 20, lineHeight: 26, color: T.chalk },
  probRow: { flexDirection: "row", alignItems: "center", gap: SP.lg, marginTop: SP.md },
  prob: { fontFamily: F.title, fontSize: 34, lineHeight: 40, fontVariant: ["tabular-nums"], minWidth: 104 },
  probSide: { flex: 1, gap: SP.sm },
  confRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  conf: { fontFamily: F.body, fontSize: 12, color: T.chalkDim },
  reason: { fontSize: 12.5, lineHeight: 18, color: T.chalkDim, fontStyle: "italic", marginTop: SP.md },
  add: { marginTop: SP.md },
});
