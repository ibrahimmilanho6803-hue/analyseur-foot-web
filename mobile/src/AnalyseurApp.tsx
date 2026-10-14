import React, { useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TabBar from "./components/TabBar";
import { useAnalyseur } from "./hooks/useAnalyseur";
import { useKeyboardVisible } from "./hooks/useKeyboardVisible";
import AutoScreen from "./screens/AutoScreen";
import CouponScreen from "./screens/CouponScreen";
import HistoryScreen from "./screens/HistoryScreen";
import TopMatchsScreen from "./screens/TopMatchsScreen";
import { F, RD, SP, T, alpha } from "./theme";
import { Bold, Txt } from "./ui";

// Pastille de l'application (même dessin que l'icône du téléphone), en petit.
const LOGO = require("../assets/logo.png");

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
        <Image source={LOGO} style={s.logoBig} aria-hidden />
        <ActivityIndicator color={T.gold} style={s.spinner} />
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
          contentContainerStyle={[s.content, { paddingLeft: SP.lg + insets.left, paddingRight: SP.lg + insets.right }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={s.header}>
            <View style={s.brand}>
              <Image source={LOGO} style={s.logo} aria-hidden />
              <View style={s.brandText}>
                <Text role="heading" style={s.title}>
                  Analyseur Foot Pro
                </Text>
                <Txt style={s.tagline}>Pronostics football : statistiques et IA</Txt>
              </View>
            </View>
            <View style={s.stats}>
              <View style={s.stat}>
                <Feather name="target" size={16} color={T.gold} />
                <Txt style={s.statText}>
                  Réussite : <Bold style={{ color: T.gold }}>{stats.rate !== null ? `${stats.rate} %` : "-"}</Bold>
                </Txt>
              </View>
              <View style={s.stat}>
                <Feather name="check-circle" size={16} color={T.chalkDim} />
                <Txt style={s.statText}>
                  Clôturés : <Bold>{stats.closedCount}</Bold>
                </Txt>
              </View>
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
  logoBig: { width: 72, height: 72, borderRadius: 18, marginBottom: SP.lg },
  spinner: { marginBottom: SP.sm },
  loading: { color: T.chalkDim },
  content: { paddingTop: SP.sm, paddingBottom: SP.lg },
  header: { paddingTop: SP.sm, paddingBottom: SP.lg, gap: SP.md },
  brand: { flexDirection: "row", alignItems: "center", gap: SP.md },
  logo: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: alpha(T.gold, 0.35) },
  brandText: { flex: 1 },
  title: { fontFamily: F.title, fontSize: 25, lineHeight: 30, letterSpacing: 0.6, color: T.chalk },
  tagline: { fontSize: 12.5, color: T.chalkDim, marginTop: 1 },
  stats: { flexDirection: "row", gap: SP.sm },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: SP.sm, backgroundColor: T.surface, borderColor: T.line, borderWidth: 1, borderRadius: RD.md, paddingVertical: 10, paddingHorizontal: SP.md },
  statText: { fontSize: 13, color: T.chalkDim },
  disclaimer: { fontSize: 11, lineHeight: 16, color: T.faint, textAlign: "center", paddingHorizontal: SP.sm, paddingTop: SP.md, paddingBottom: SP.sm },
});
