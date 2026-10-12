import React, { useEffect, useRef } from "react";
import { BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TabBar from "./components/TabBar";
import { useAnalyseur } from "./hooks/useAnalyseur";
import { useKeyboardVisible } from "./hooks/useKeyboardVisible";
import AutoScreen from "./screens/AutoScreen";
import CouponScreen from "./screens/CouponScreen";
import HistoryScreen from "./screens/HistoryScreen";
import TopMatchsScreen from "./screens/TopMatchsScreen";
import { F, T } from "./theme";
import { Bold, Txt } from "./ui";

// Mention affichée en bas de chaque écran : mêmes termes que sur le site.
export const DISCLAIMER =
  "Probabilités estimées par un modèle statistique relu par l'IA : ce ne sont jamais des certitudes. Les cotes affichées sont des cotes équitables estimées, sans marge de bookmaker. Jouez avec modération.";

// L'application entière : en-tête, écran de l'onglet actif, barre d'onglets en bas.
export default function AnalyseurApp() {
  const c = useAnalyseur();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const scroller = useRef<ScrollView>(null);
  const { activeTab, setActiveTab } = c;

  // Le bouton « retour » d'Android ramène d'abord à « Mon coupon » ; il ne quitte l'application que depuis cet onglet.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeTab === "build") return false;
      setActiveTab("build");
      return true;
    });
    return () => subscription.remove();
  }, [activeTab, setActiveTab]);

  // Chaque onglet s'ouvre en haut de page.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  if (c.loading) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <Txt style={s.loading}>Chargement…</Txt>
      </View>
    );
  }

  const { stats } = c;
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* « padding » ne remonte la page que du recouvrement réel par le clavier : sans effet si Android a déjà redimensionné la fenêtre. */}
      <KeyboardAvoidingView style={s.flex} behavior="padding">
        <ScrollView
          ref={scroller}
          style={s.flex}
          contentContainerStyle={[s.content, { paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={s.header}>
            <Text role="heading" style={s.title}>
              Analyseur Foot Pro
            </Text>
            <View style={s.stats}>
              <Txt style={s.stat}>
                Réussite : <Bold style={{ color: T.gold }}>{stats.rate !== null ? `${stats.rate} %` : "-"}</Bold>
              </Txt>
              <Txt style={s.stat}>
                Clôturés : <Bold>{stats.closedCount}</Bold>
              </Txt>
            </View>
          </View>

          {activeTab === "top" ? <TopMatchsScreen c={c} /> : null}
          {activeTab === "build" ? <CouponScreen c={c} /> : null}
          {activeTab === "gen" ? <AutoScreen c={c} /> : null}
          {activeTab === "history" ? <HistoryScreen c={c} /> : null}

          <Txt style={s.disclaimer}>{DISCLAIMER}</Txt>
        </ScrollView>
        {keyboardVisible ? null : <TabBar active={activeTab} onSelect={c.openTab} />}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgDeep },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  loading: { color: T.chalkDim },
  content: { paddingTop: 4, paddingBottom: 16 },
  header: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  title: { fontFamily: F.title, fontSize: 24, letterSpacing: 1, color: T.chalk },
  stats: { flexDirection: "row", gap: 14, marginTop: 4 },
  stat: { fontSize: 12, color: T.chalkDim },
  disclaimer: { fontSize: 11, lineHeight: 16, color: T.chalkDim, textAlign: "center", paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8 },
});
