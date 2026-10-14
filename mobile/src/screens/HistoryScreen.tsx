import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { canonicalLabel, REFUND_WHEN } from "../betTypes";
import { formatDay } from "../format";
import type { Controller } from "../hooks/useAnalyseur";
import { F, RD, SP, T, alpha } from "../theme";
import type { Pronostic } from "../types";
import { Badge, Bold, Card, EmptyState, IconBtn, ScreenTitle, Txt } from "../ui";

// Pastille d'un pari déjà joué : « V » (gagné) ou « X » (perdu).
function Result({ won }: { won: boolean }) {
  const color = won ? T.win : T.loss;
  return (
    <View style={[s.result, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.5) }]}>
      <Text style={[s.resultText, { color }]}>{won ? "V" : "X"}</Text>
    </View>
  );
}

function Row({ p, last, c }: { p: Pronostic; last: boolean; c: Controller }) {
  const pending = p.statut === "en_attente";
  const rule = REFUND_WHEN[canonicalLabel(p.typePari)];
  return (
    <View style={[s.row, last && s.rowLast]}>
      <View style={s.rowMain}>
        <Txt style={s.rowText}>
          <Bold>
            {p.equipe1} vs {p.equipe2}
          </Bold>
          {` - ${canonicalLabel(p.typePari)}`}
        </Txt>
        {pending && rule ? <Txt style={s.rowHint}>Remboursé si {rule} : dans ce cas, supprimez ce pari.</Txt> : null}
      </View>
      {pending ? (
        <View style={s.actions}>
          <IconBtn icon="check" ariaLabel="Marquer comme gagné" color={T.win} bordered onPress={() => void c.setSelStatut(p.id, "gagne")} />
          <IconBtn icon="x" ariaLabel="Marquer comme perdu" color={T.loss} bordered onPress={() => void c.setSelStatut(p.id, "perdu")} />
        </View>
      ) : (
        <Result won={p.statut === "gagne"} />
      )}
      <IconBtn icon="trash-2" ariaLabel="Supprimer ce pari" onPress={() => void c.removeSel(p.id)} />
    </View>
  );
}

// Onglet « Historique » : les coupons enregistrés, du plus récent au plus ancien. Chaque pari se marque gagné ou perdu une fois le match joué.
export default function HistoryScreen({ c }: { c: Controller }) {
  const { coupons } = c;
  return (
    <View>
      <ScreenTitle icon="clock" title="Historique" subtitle={coupons.length > 0 ? "Marquez chaque pari gagné ou perdu une fois le match joué." : undefined} />
      {coupons.length === 0 ? (
        <Card>
          <EmptyState icon="inbox" title="Aucun coupon" text="Enregistrez un coupon depuis l'onglet « Mon coupon » : il apparaîtra ici." />
        </Card>
      ) : null}
      {coupons.map((group) => {
        const allDone = group.every((p) => p.statut !== "en_attente");
        const won = allDone && group.every((p) => p.statut === "gagne");
        const tone = !allDone ? "gold" : won ? "win" : "loss";
        const color = !allDone ? T.gold : won ? T.win : T.loss;
        return (
          <Card key={group[0].couponId || group[0].id} style={[s.group, { borderLeftColor: color }]}>
            <View style={s.groupHead}>
              <Txt style={s.date}>{formatDay(group[0].date)}</Txt>
              <Badge label={!allDone ? "En attente" : won ? "Gagné" : "Perdu"} tone={tone} icon={!allDone ? "clock" : won ? "check-circle" : "x-circle"} />
            </View>
            {group.map((p, i) => (
              <Row key={p.id} p={p} last={i === group.length - 1} c={c} />
            ))}
          </Card>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderLeftWidth: 4, paddingVertical: SP.md },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SP.xs },
  date: { fontFamily: F.monoMedium, fontSize: 12.5, color: T.chalkDim },
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: SP.sm, borderBottomColor: T.line, borderBottomWidth: 1 },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowMain: { flex: 1, minWidth: 0 },
  rowText: { fontSize: 13.5, lineHeight: 19, color: T.chalkDim },
  rowHint: { fontSize: 11.5, lineHeight: 16, color: T.faint, marginTop: 3 },
  actions: { flexDirection: "row", gap: 6, marginRight: 2 },
  result: { width: 34, height: 34, borderRadius: RD.md, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 2 },
  resultText: { fontFamily: F.title, fontSize: 16, lineHeight: 20 },
});
