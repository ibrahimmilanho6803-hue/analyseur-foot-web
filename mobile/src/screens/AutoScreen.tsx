import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import TeamInput from "../components/TeamInput";
import type { Controller } from "../hooks/useAnalyseur";
import { F, RD, SP, T, alpha } from "../theme";
import { Btn, Card, IconBtn, LinkBtn, Note, SectionTitle, Txt } from "../ui";

// Onglet « Auto » : on saisit des matchs, le serveur choisit un pari par match pour atteindre la cote visée.
export default function AutoScreen({ c }: { c: Controller }) {
  const { genForm, catalog, matchesToGenerate, genReport, genLoading } = c;
  const empty = matchesToGenerate.length === 0;
  const found = Boolean(genReport && genReport.added > 0);

  return (
    <Card>
      <SectionTitle icon="cpu">Génération automatique</SectionTitle>
      <Txt style={s.intro}>
        Saisissez au moins 3 matchs : le serveur choisit pour chacun un pari de façon que la cote totale du coupon atteigne 5, avec des paris aussi fiables que possible. L'équipe 1 reçoit, l'équipe 2 se déplace. Les deux clubs peuvent
        venir de championnats différents (Ligue des champions, par exemple) : l'estimation est alors moins précise.
      </Txt>

      <TeamInput
        label="Équipe 1 du match à générer"
        placeholder="Équipe 1"
        icon="home"
        value={genForm.equipe1}
        onChange={(v) => c.setGenForm((f) => ({ ...f, equipe1: v }))}
        index={catalog.index}
        complete={catalog.complete}
        onFocus={catalog.refresh}
      />
      <TeamInput
        label="Équipe 2 du match à générer"
        placeholder="Équipe 2"
        icon="map-pin"
        value={genForm.equipe2}
        onChange={(v) => c.setGenForm((f) => ({ ...f, equipe2: v }))}
        index={catalog.index}
        complete={catalog.complete}
        onFocus={catalog.refresh}
      />
      <Btn label="Ajouter" icon="plus" kind="secondary" onPress={c.addMatchToGenerate} />

      {empty ? null : (
        <View style={s.list}>
          {matchesToGenerate.map((m, i) => (
            <View key={m.id} style={s.item}>
              <View style={s.rank}>
                <Text style={s.rankText}>{i + 1}</Text>
              </View>
              <Txt style={s.itemText}>
                {m.equipe1} vs {m.equipe2}
              </Txt>
              <IconBtn icon="trash-2" ariaLabel={`Retirer ${m.equipe1} vs ${m.equipe2}`} onPress={() => c.removeFromGenerate(m.id)} />
            </View>
          ))}
        </View>
      )}

      {genReport ? (
        <View style={s.report}>
          {found ? (
            <View style={s.reportOk}>
              <Note tone="ok" style={s.reportNote}>{`${genReport.added} pronostic${genReport.added > 1 ? "s ajoutés" : " ajouté"} à « Mon coupon ».`}</Note>
              <LinkBtn label="Voir mon coupon" icon="arrow-right" onPress={() => c.setActiveTab("build")} color={T.gold} />
            </View>
          ) : null}
          {genReport.problems.map((problem, i) => (
            <Note key={i} tone={found ? "warn" : "bad"} style={s.reportNote}>
              {problem}
            </Note>
          ))}
          {genReport.notice ? (
            <Note style={s.reportNote}>{genReport.notice}</Note>
          ) : null}
        </View>
      ) : null}

      <View style={s.generate}>
        <Btn label={genLoading ? "Génération…" : "Générer mon coupon"} icon="zap" onPress={() => void c.generateAutoCoupon()} disabled={empty || genLoading} />
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
  intro: { fontSize: 13, lineHeight: 19, color: T.chalkDim, marginBottom: SP.lg },
  list: { marginTop: SP.lg, gap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: SP.sm, backgroundColor: T.raised, borderColor: T.line, borderWidth: 1, borderRadius: RD.md, paddingLeft: SP.sm, paddingRight: 4, paddingVertical: 4 },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: alpha(T.gold, 0.14) },
  rankText: { fontFamily: F.monoMedium, fontSize: 12, color: T.gold },
  itemText: { flex: 1, fontSize: 14.5, lineHeight: 20, fontFamily: F.bodyMedium },
  report: { marginTop: SP.md, gap: 6 },
  reportOk: { gap: 6, alignItems: "flex-start" },
  reportNote: { marginTop: 0, alignSelf: "stretch" },
  generate: { marginTop: SP.lg },
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm, marginTop: SP.md },
  progressText: { color: T.chalkDim, fontFamily: F.body, fontSize: 12.5 },
});
