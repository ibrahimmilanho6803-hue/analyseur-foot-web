import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { crossLeagueNote, asCross } from "../estimates";
import { confidenceLabel, formatDate } from "../format";
import type { Controller } from "../hooks/useAnalyseur";
import { F, T, alpha } from "../theme";
import type { TopMatch } from "../types";
import { Bold, Btn, Card, LinkBtn, Note, Txt } from "../ui";

function probColor(p: number): string {
  return p >= 70 ? T.win : p >= 55 ? T.gold : T.loss;
}

function MatchCard({ match, first, showDetails, added, onAdd }: { match: TopMatch; first: boolean; showDetails: boolean; added: boolean; onAdd: () => void }) {
  const cross = asCross(match.comparaisonEntreChampionnats); // clubs de championnats différents (Ligue des champions…)
  return (
    <View style={[s.match, first && s.matchFirst]}>
      <View style={s.matchHead}>
        <View style={s.compWrap}>
          {first ? <Feather name="star" size={16} color={T.gold} /> : null}
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
      <Txt style={s.bet}>
        Pari conseillé : <Bold>{match.meilleurPari}</Bold>
      </Txt>
      <View style={s.probRow}>
        <Text style={[s.prob, { color: probColor(match.probabilite) }]}>{match.probabilite} %</Text>
        <Text style={s.meta}>Confiance : {confidenceLabel(match.niveauConfiance)}</Text>
        {typeof match.coteEstimee === "number" ? <Text style={s.metaPlain}>Cote estimée {match.coteEstimee.toFixed(2)}</Text> : null}
      </View>
      {cross ? <Note>{crossLeagueNote(cross)}</Note> : null}
      {showDetails && match.justification ? <Txt style={s.reason}>{match.justification}</Txt> : null}
      {showDetails && match.vigilance ? <Txt style={s.vigilance}>À surveiller : {match.vigilance}</Txt> : null}
      <Btn label={added ? "Déjà dans le coupon" : "Ajouter ce pronostic"} onPress={onAdd} disabled={added} compact />
    </View>
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

  return (
    <Card accent>
      <View style={s.head}>
        <Feather name="zap" size={18} color={T.gold} />
        <Txt role="heading" style={s.title}>
          Top 3 Matchs à venir
        </Txt>
      </View>
      <Txt style={s.sub}>
        {nb ? `Analyse de ${scope}, matchs des ${topMeta ? topMeta.fenetreHeures : ""} prochaines heures.` : "Analyse des championnats couverts par le serveur."}
      </Txt>

      {topLoading ? (
        <View style={s.loading} role="progressbar" aria-busy>
          <ActivityIndicator color={T.gold} />
          <Txt style={s.loadingText}>Analyse des matchs en cours… (jusqu'à une minute)</Txt>
        </View>
      ) : null}
      {topError ? <Txt style={s.error}>{topError}</Txt> : null}
      {!topLoading && topMeta && topMeta.message ? <Note>{topMeta.message}</Note> : null}
      {!topLoading && iaDown ? <Note>La relecture par l'IA n'a pas pu être faite pour tous les matchs : ces probabilités viennent du modèle statistique seul.</Note> : null}
      {!topLoading && iaOff ? <Note>La relecture par l'IA est désactivée sur le serveur : probabilités du modèle statistique seul.</Note> : null}
      {!topLoading && topMeta && topMeta.perime ? <Note>Sélection précédente conservée : les données n'ont pas pu être actualisées.</Note> : null}
      {!topLoading && topMeta && topMeta.complet === false ? <Note>Certains championnats sont encore en cours de chargement : la sélection peut évoluer dans quelques minutes.</Note> : null}
      {!topLoading && topMeta && topMeta.avertissementDonnees ? <Note>{topMeta.avertissementDonnees}</Note> : null}

      {!topLoading && topMatches.length > 0 && topMeta ? (
        <View style={s.summary}>
          <View style={s.summaryRow}>
            <Txt style={s.summaryText}>
              Cote combinée estimée : <Bold style={{ color: T.gold }}>{topMeta.coteTotale}</Bold>
            </Txt>
            <Txt style={s.summaryText}>
              Probabilité combinée : <Bold>{topMeta.probabiliteCombinee} %</Bold>
            </Txt>
          </View>
          {topMeta.objectifCoteAtteint === false ? <Txt style={s.summaryNote}>Objectif de cote ({topMeta.objectifCote}) non atteint avec les matchs disponibles.</Txt> : null}
          {topMeta.avertissement ? <Txt style={s.summaryNote}>{topMeta.avertissement}</Txt> : null}
        </View>
      ) : null}

      {topMatches.map((match, i) => (
        <MatchCard key={String(match.id ?? i)} match={match} first={i === 0} showDetails={showDetails} added={c.isInDraft(match)} onAdd={() => c.addTopMatchToDraft(match)} />
      ))}

      {!topLoading && topAt === 0 && topMatches.length === 0 && !topError ? <Btn label="Chercher les meilleurs matchs" onPress={() => void c.fetchTopMatches()} /> : null}
      <View style={s.links}>
        {!topLoading && (topAt > 0 || topError) ? <LinkBtn label="Actualiser" onPress={() => void c.fetchTopMatches()} color={T.gold} /> : null}
        <LinkBtn label={showDetails ? "Masquer" : "Détails"} onPress={c.toggleDetails} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontFamily: F.titleMedium, fontSize: 16, textTransform: "uppercase", letterSpacing: 1, color: T.gold },
  sub: { fontSize: 13, lineHeight: 18, color: T.chalkDim, marginBottom: 10 },
  loading: { alignItems: "center", gap: 8, paddingVertical: 18 },
  loadingText: { color: T.chalkDim, fontSize: 13, textAlign: "center" },
  error: { color: T.loss, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  summary: { backgroundColor: T.bgDeep, borderColor: T.line, borderWidth: 1, borderRadius: 10, padding: 12, marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  summaryText: { fontSize: 13 },
  summaryNote: { color: T.chalkDim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  match: { borderColor: T.line, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: T.bgDeep },
  matchFirst: { borderColor: T.gold, backgroundColor: alpha(T.gold, 0.07) },
  matchHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  compWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  chip: { fontFamily: F.body, fontSize: 11, color: T.chalkDim, backgroundColor: T.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: "hidden", flexShrink: 1 },
  date: { fontFamily: F.body, fontSize: 11, color: T.chalkDim },
  teams: { fontFamily: F.bodySemi, fontSize: 16, marginBottom: 4 },
  bet: { fontSize: 13, color: T.gold, marginBottom: 6 },
  probRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  prob: { fontFamily: F.mono, fontSize: 26 },
  meta: { fontFamily: F.body, fontSize: 11, color: T.chalkDim, textTransform: "uppercase" },
  metaPlain: { fontFamily: F.body, fontSize: 11, color: T.chalkDim },
  reason: { fontSize: 12, lineHeight: 17, color: T.chalkDim, fontStyle: "italic", marginBottom: 8 },
  vigilance: { fontSize: 12, lineHeight: 17, color: T.gold, marginBottom: 8 },
  links: { flexDirection: "row", gap: 18, marginTop: 8 },
});
