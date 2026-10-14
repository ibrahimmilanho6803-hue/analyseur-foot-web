import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import TeamInput from "../components/TeamInput";
import type { Controller } from "../hooks/useAnalyseur";
import { F, T } from "../theme";
import { Btn, Card, IconBtn, LinkBtn, SectionTitle, Txt } from "../ui";

// Onglet « Auto » : on saisit des matchs, le serveur choisit le pari le plus sûr de chacun.
export default function AutoScreen({ c }: { c: Controller }) {
  const { genForm, catalog, matchesToGenerate, genReport, genLoading } = c;
  const empty = matchesToGenerate.length === 0;
  const found = Boolean(genReport && genReport.added > 0);

  return (
    <Card>
      <SectionTitle>Génération automatique</SectionTitle>
      <Txt style={s.intro}>
        Saisissez des matchs : le serveur choisit pour chacun le pari le plus sûr dont la probabilité reste intéressante (entre 55 % et 88 %). L'équipe 1 reçoit, l'équipe 2 se déplace. Les deux clubs peuvent venir de championnats
        différents (Ligue des champions, par exemple) : l'estimation est alors moins précise.
      </Txt>

      <TeamInput
        label="Équipe 1 du match à générer"
        placeholder="Équipe 1"
        value={genForm.equipe1}
        onChange={(v) => c.setGenForm((f) => ({ ...f, equipe1: v }))}
        index={catalog.index}
        complete={catalog.complete}
        onFocus={catalog.refresh}
      />
      <TeamInput
        label="Équipe 2 du match à générer"
        placeholder="Équipe 2"
        value={genForm.equipe2}
        onChange={(v) => c.setGenForm((f) => ({ ...f, equipe2: v }))}
        index={catalog.index}
        complete={catalog.complete}
        onFocus={catalog.refresh}
      />
      <Btn label="Ajouter" icon="plus" kind="dashed" onPress={c.addMatchToGenerate} />

      {empty ? null : (
        <View style={s.list}>
          {matchesToGenerate.map((m) => (
            <View key={m.id} style={s.item}>
              <Txt style={s.itemText}>
                {m.equipe1} vs {m.equipe2}
              </Txt>
              <IconBtn icon="trash-2" ariaLabel={`Retirer ${m.equipe1} vs ${m.equipe2}`} onPress={() => c.removeFromGenerate(m.id)} />
            </View>
          ))}
        </View>
      )}

      {genReport ? (
        <View style={[s.report, { borderColor: found ? T.gold : T.loss }]}>
          {found ? (
            <View style={s.reportOk}>
              <Txt style={s.reportOkText}>
                {genReport!.added} pronostic{genReport!.added > 1 ? "s ajoutés" : " ajouté"} à « Mon coupon ».
              </Txt>
              <LinkBtn label="Voir mon coupon" onPress={() => c.setActiveTab("build")} color={T.gold} />
            </View>
          ) : null}
          {genReport.problems.map((problem, i) => (
            <Txt key={i} style={[s.problem, { color: found ? T.gold : T.loss }]}>
              {problem}
            </Txt>
          ))}
        </View>
      ) : null}

      <View style={s.generate}>
        <Btn label={genLoading ? "Génération…" : "Générer mon coupon"} onPress={() => void c.generateAutoCoupon()} disabled={empty || genLoading} />
      </View>
      {genLoading ? (
        <View style={s.progress}>
          <ActivityIndicator color={T.gold} size="small" />
          <Txt style={s.progressText}>Analyse en cours : jusqu'à une minute.</Txt>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 18, color: T.chalkDim, marginBottom: 12 },
  list: { marginTop: 12 },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: T.bgDeep, borderRadius: 8, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, marginBottom: 6 },
  itemText: { flex: 1, fontSize: 14 },
  report: { marginTop: 8, padding: 10, backgroundColor: T.bgDeep, borderWidth: 1, borderRadius: 8 },
  reportOk: { marginBottom: 6, gap: 4 },
  reportOkText: { color: T.win, fontSize: 13, lineHeight: 18 },
  problem: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  generate: { marginTop: 12 },
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  progressText: { color: T.chalkDim, fontFamily: F.body, fontSize: 12 },
});
