import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatDay } from "../format";
import type { Controller } from "../hooks/useAnalyseur";
import { F, T } from "../theme";
import { Card, IconBtn, SectionTitle, Txt } from "../ui";

// Onglet « Historique » : les coupons enregistrés, du plus récent au plus ancien. Chaque pari se marque gagné ou perdu une fois le match joué.
export default function HistoryScreen({ c }: { c: Controller }) {
  const { coupons } = c;
  return (
    <Card>
      <SectionTitle>Historique</SectionTitle>
      {coupons.length === 0 ? <Txt style={s.empty}>Aucun coupon</Txt> : null}
      {coupons.map((group) => {
        const allDone = group.every((p) => p.statut !== "en_attente");
        const won = allDone && group.every((p) => p.statut === "gagne");
        const color = !allDone ? T.gold : won ? T.win : T.loss;
        return (
          <View key={group[0].couponId || group[0].id} style={[s.group, { borderColor: allDone ? color : T.line }]}>
            <View style={s.groupHead}>
              <Txt style={s.date}>{formatDay(group[0].date)}</Txt>
              <Text style={[s.status, { color }]}>{!allDone ? "En attente" : won ? "Gagné" : "Perdu"}</Text>
            </View>
            {group.map((p, i) => (
              <View key={p.id} style={[s.row, i === group.length - 1 && s.rowLast]}>
                <Txt style={s.rowText}>
                  {p.equipe1} vs {p.equipe2} - {p.typePari}
                </Txt>
                {p.statut === "en_attente" ? (
                  <View style={s.actions}>
                    <IconBtn icon="check" ariaLabel="Marquer comme gagné" color={T.win} bordered onPress={() => void c.setSelStatut(p.id, "gagne")} />
                    <IconBtn icon="x" ariaLabel="Marquer comme perdu" color={T.loss} bordered onPress={() => void c.setSelStatut(p.id, "perdu")} />
                  </View>
                ) : (
                  <Text style={[s.result, { color: p.statut === "gagne" ? T.win : T.loss }]}>{p.statut === "gagne" ? "V" : "X"}</Text>
                )}
                <IconBtn icon="trash-2" ariaLabel="Supprimer ce pari" onPress={() => void c.removeSel(p.id)} />
              </View>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

const s = StyleSheet.create({
  empty: { textAlign: "center", color: T.chalkDim, paddingVertical: 20 },
  group: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  date: { fontSize: 12, color: T.chalkDim },
  status: { fontFamily: F.bodySemi, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, borderBottomColor: T.line, borderBottomWidth: 1 },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 6 },
  result: { fontFamily: F.bodySemi, fontSize: 14, minWidth: 18, textAlign: "center" },
});
