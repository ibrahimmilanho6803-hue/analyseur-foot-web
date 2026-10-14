import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BET_GROUPS } from "../betTypes";
import { F, T, alpha } from "../theme";
import { Txt } from "../ui";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

// Famille du type de pari choisi (la liste s'ouvre dessus).
const groupOf = (type: string): string | null => BET_GROUPS.find((g) => g.types.includes(type))?.title ?? null;

// Choix du type de pari : un champ qui ouvre une feuille en bas de l'écran, avec les paris regroupés par famille. Les familles sont
// repliées (une seule est ouverte à la fois) : avec une centaine de paris, la liste complète serait interminable à faire défiler.
export default function BetTypePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const openSheet = () => {
    setExpanded(groupOf(value) ?? BET_GROUPS[0].title);
    setOpen(true);
  };

  const choose = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  return (
    <View style={s.wrap}>
      <Txt style={s.label}>Type de pari</Txt>
      <Pressable role="button" aria-label={`Type de pari : ${value}`} aria-expanded={open} onPress={openSheet} style={s.field}>
        <Text style={s.fieldText} numberOfLines={1}>
          {value}
        </Text>
        <Feather name="chevron-down" size={20} color={T.chalkDim} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <View style={s.overlay}>
          <Pressable aria-label="Fermer la liste des paris" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.sheetHead}>
              <Txt role="heading" style={s.sheetTitle}>
                Type de pari
              </Txt>
              <Pressable role="button" aria-label="Fermer" onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={T.chalkDim} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: height * 0.66 }} showsVerticalScrollIndicator={false}>
              {BET_GROUPS.map((group) => {
                const isOpen = expanded === group.title;
                const holdsChoice = group.types.includes(value);
                return (
                  <View key={group.title}>
                    <Pressable
                      role="button"
                      aria-label={group.title}
                      aria-expanded={isOpen}
                      onPress={() => setExpanded(isOpen ? null : group.title)}
                      style={({ pressed }) => [s.groupHead, pressed && { backgroundColor: alpha(T.gold, 0.08) }]}
                    >
                      <Txt style={[s.groupTitle, holdsChoice && { color: T.gold }]}>{group.title}</Txt>
                      <Text style={s.groupCount}>{group.types.length}</Text>
                      <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={T.chalkDim} />
                    </Pressable>
                    {isOpen
                      ? group.types.map((type) => {
                          const selected = type === value;
                          return (
                            <Pressable
                              key={type}
                              role="radio"
                              aria-label={type}
                              aria-checked={selected}
                              onPress={() => choose(type)}
                              style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && { backgroundColor: alpha(T.gold, 0.13) }]}
                            >
                              <Text style={[s.optionText, selected && { color: T.gold, fontFamily: F.bodySemi }]}>{type}</Text>
                              {selected ? <Feather name="check" size={18} color={T.gold} /> : null}
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, color: T.chalkDim, marginBottom: 4 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 48,
    backgroundColor: T.bgDeep,
    borderColor: T.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  fieldText: { flex: 1, color: T.chalk, fontFamily: F.body, fontSize: 16 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderColor: T.line, borderWidth: 1, paddingHorizontal: 14, paddingTop: 14 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle: { fontFamily: F.title, fontSize: 18, letterSpacing: 0.5 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 10, borderRadius: 8, borderBottomColor: T.line, borderBottomWidth: 1 },
  groupTitle: { flex: 1, fontFamily: F.titleMedium, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim },
  groupCount: { fontFamily: F.mono, fontSize: 12, color: T.chalkDim },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46, paddingHorizontal: 10, borderRadius: 8 },
  optionSelected: { backgroundColor: alpha(T.gold, 0.1) },
  optionText: { flex: 1, color: T.chalk, fontFamily: F.body, fontSize: 15 },
});
