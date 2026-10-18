import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F, RD, T, alpha } from "../theme";
import type { TabKey } from "../types";
import type { IconName } from "../ui";

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "top", label: "Top Matchs", icon: "zap" },
  { key: "build", label: "Mon coupon", icon: "clipboard" },
  { key: "gen", label: "Auto", icon: "cpu" },
  { key: "history", label: "Historique", icon: "clock" },
];

// Barre d'onglets en bas de l'écran, à portée du pouce : l'onglet ouvert a sa pastille dorée.
export default function TabBar({ active, onSelect }: { active: TabKey; onSelect: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View role="tablist" style={[s.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} role="tab" aria-label={tab.label} aria-selected={selected} onPress={() => onSelect(tab.key)} style={s.tab}>
            <View style={[s.pill, selected && s.pillOn]}>
              <Feather name={tab.icon} size={21} color={selected ? T.gold : T.chalkDim} />
            </View>
            <Text style={[s.label, { color: selected ? T.gold : T.chalkDim, fontFamily: selected ? F.bodySemi : F.body }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: T.surface, borderTopColor: T.line, borderTopWidth: 1, paddingTop: 8, boxShadow: "0 -6px 18px rgba(0,0,0,0.35)" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 54, paddingHorizontal: 2 },
  pill: { width: 58, height: 30, borderRadius: RD.pill, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: alpha(T.gold, 0.16) },
  label: { fontSize: 11.5 },
});
