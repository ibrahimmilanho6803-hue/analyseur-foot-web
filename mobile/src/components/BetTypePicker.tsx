import React, { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { groupOf, searchGroups } from "../betSearch";
import { BET_GROUPS, REFUND_WHEN, canonicalLabel } from "../betTypes";
import { F, RD, SP, T, alpha } from "../theme";
import { IconBtn, Note, Txt } from "../ui";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

// Choix du type de pari : un champ qui ouvre une feuille en bas de l'écran. Une centaine de paris y sont regroupés par famille : les
// familles se déplient une à la fois (celle du pari actuel est ouverte), et une recherche (« plus de 2.5 », « nul ») les parcourt toutes.
export default function BetTypePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const tops = useRef<Record<string, number>>({}); // position de chaque famille dans la liste
  const toReveal = useRef<string | null>(null); // famille à ramener en haut de la liste dès qu'elle est mise en page

  const searching = query.trim().length > 0;
  const groups = useMemo(() => (searching ? searchGroups(query) : BET_GROUPS), [query, searching]);
  const refund = REFUND_WHEN[canonicalLabel(value)];

  const show = () => {
    const group = groupOf(value);
    setQuery("");
    setExpanded(group);
    toReveal.current = group;
    setOpen(true);
  };

  const toggle = (title: string) => {
    const opening = expanded !== title;
    setExpanded(opening ? title : null);
    toReveal.current = opening ? title : null;
  };

  const choose = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  // Quand une famille s'ouvre, les autres se replient : on la remonte en haut de la liste pour qu'elle ne parte pas hors de l'écran.
  const placed = (title: string, y: number) => {
    tops.current[title] = y;
    if (toReveal.current === title && scroller.current) {
      toReveal.current = null;
      scroller.current.scrollTo({ y: Math.max(0, y - 4), animated: true });
    }
  };

  return (
    <View style={s.wrap}>
      <Txt style={s.label}>Type de pari</Txt>
      <Pressable
        role="button"
        aria-label={`Type de pari : ${value}`}
        aria-expanded={open}
        onPress={show}
        style={({ pressed }) => [s.field, pressed && { borderColor: T.gold }]}
      >
        <Feather name="target" size={18} color={T.gold} />
        <Text style={s.fieldText} numberOfLines={2}>
          {value}
        </Text>
        <Feather name="chevron-down" size={20} color={T.chalkDim} />
      </Pressable>
      {refund ? <Note tone="info">Ligne entière : remboursé si {refund}.</Note> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <View style={s.overlay}>
          <Pressable aria-label="Fermer la liste des paris" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[s.sheet, { maxHeight: height * 0.9, paddingBottom: insets.bottom + SP.md }]}>
            <View style={s.grabber} />
            <View style={s.sheetHead}>
              <Txt role="heading" style={s.sheetTitle}>
                Type de pari
              </Txt>
              <IconBtn icon="x" ariaLabel="Fermer" onPress={() => setOpen(false)} />
            </View>

            <View style={s.search}>
              <Feather name="search" size={18} color={T.chalkDim} />
              <TextInput
                aria-label="Rechercher un pari"
                placeholder="Rechercher (ex. plus de 2.5, nul…)"
                placeholderTextColor={T.faint}
                selectionColor={T.gold}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="search"
                style={s.searchInput}
              />
              {query ? <IconBtn icon="x" ariaLabel="Effacer la recherche" onPress={() => setQuery("")} /> : null}
            </View>

            <ScrollView ref={scroller} style={s.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {groups.length === 0 ? <Txt style={s.noResult}>Aucun pari ne correspond à « {query.trim()} ».</Txt> : null}
              {groups.map((group) => {
                const isOpen = searching || expanded === group.title;
                const holdsValue = group.types.includes(canonicalLabel(value));
                return (
                  <View key={group.title} onLayout={(e) => placed(group.title, e.nativeEvent.layout.y)} style={[s.group, isOpen && s.groupOpen]}>
                    <Pressable
                      role="button"
                      aria-label={group.title}
                      aria-expanded={isOpen}
                      disabled={searching}
                      onPress={() => toggle(group.title)}
                      style={({ pressed }) => [s.groupHead, pressed && { backgroundColor: alpha(T.gold, 0.08) }]}
                    >
                      <Text style={[s.groupTitle, isOpen && { color: T.chalk }]}>{group.title}</Text>
                      {holdsValue && !isOpen ? <View style={s.dot} /> : null}
                      <Text style={s.count}>{group.types.length}</Text>
                      {searching ? null : <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={T.chalkDim} />}
                    </Pressable>
                    {isOpen
                      ? group.types.map((type) => {
                          const selected = type === canonicalLabel(value);
                          const rule = REFUND_WHEN[type];
                          return (
                            <Pressable
                              key={type}
                              role="radio"
                              aria-label={type}
                              aria-checked={selected}
                              onPress={() => choose(type)}
                              style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && { backgroundColor: alpha(T.gold, 0.14) }]}
                            >
                              <View style={[s.radio, selected && s.radioOn]}>{selected ? <View style={s.radioDot} /> : null}</View>
                              <View style={s.optionBody}>
                                <Text style={[s.optionText, selected && { color: T.gold, fontFamily: F.bodySemi }]}>{type}</Text>
                                {rule ? <Text style={s.optionRule}>Remboursé si {rule}</Text> : null}
                              </View>
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
  wrap: { marginBottom: SP.md },
  label: { fontFamily: F.bodyMedium, fontSize: 12, letterSpacing: 0.3, color: T.chalkDim, marginBottom: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    minHeight: 52,
    backgroundColor: T.raised,
    borderColor: T.line,
    borderWidth: 1,
    borderRadius: RD.md,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
  },
  fieldText: { flex: 1, color: T.chalk, fontFamily: F.bodyMedium, fontSize: 15, lineHeight: 20 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  sheet: {
    flexShrink: 1,
    backgroundColor: T.surface,
    borderTopLeftRadius: RD.xl,
    borderTopRightRadius: RD.xl,
    borderColor: T.lineStrong,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: SP.lg,
    paddingTop: SP.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, marginBottom: SP.sm },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SP.sm },
  sheetTitle: { fontFamily: F.title, fontSize: 20, letterSpacing: 0.5 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    minHeight: 48,
    backgroundColor: T.raised,
    borderColor: T.line,
    borderWidth: 1,
    borderRadius: RD.md,
    paddingLeft: SP.md,
    paddingRight: 4,
    marginBottom: SP.sm,
  },
  searchInput: { flex: 1, color: T.chalk, fontFamily: F.body, fontSize: 15, paddingVertical: 10 },
  list: { flexGrow: 0 },
  noResult: { color: T.chalkDim, textAlign: "center", paddingVertical: SP.xl, lineHeight: 20 },
  group: { borderRadius: RD.md, marginBottom: 6, borderWidth: 1, borderColor: "transparent" },
  groupOpen: { backgroundColor: alpha(T.chalk, 0.03), borderColor: T.line },
  groupHead: { flexDirection: "row", alignItems: "center", gap: SP.sm, minHeight: 50, paddingHorizontal: SP.md, borderRadius: RD.md },
  groupTitle: { flex: 1, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 20, color: T.chalkDim },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.gold },
  count: { fontFamily: F.monoMedium, fontSize: 12, color: T.faint },
  option: { flexDirection: "row", alignItems: "center", gap: SP.md, minHeight: 48, paddingHorizontal: SP.md, paddingVertical: 6, borderRadius: RD.sm, marginHorizontal: 4 },
  optionSelected: { backgroundColor: alpha(T.gold, 0.1) },
  optionBody: { flex: 1 },
  optionText: { color: T.chalk, fontFamily: F.body, fontSize: 15, lineHeight: 20 },
  optionRule: { color: T.faint, fontFamily: F.body, fontSize: 11.5, lineHeight: 16, marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: T.lineStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: T.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.gold },
});
