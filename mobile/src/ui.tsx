import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, TextProps, ViewStyle } from "react-native";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { F, T } from "./theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

// Briques d'interface communes à tous les écrans.

/** Texte courant. React Native n'impose ni couleur ni police : sans elles, le texte serait noir sur fond vert. */
export function Txt({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[s.txt, style]} />;
}

/** Texte en gras à l'intérieur d'un autre texte (il garde la couleur et la taille du texte qui le contient). */
export function Bold({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[s.bold, style]} />;
}

export function Card({ children, accent = false, style }: { children: React.ReactNode; accent?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, accent && s.cardAccent, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt role="heading" style={s.sectionTitle}>
      {children}
    </Txt>
  );
}

/** Avertissement : triangle et texte doré. */
export function Note({ children, color = T.gold }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={s.note}>
      <Feather name="alert-triangle" size={15} color={color} style={s.noteIcon} />
      <Txt style={[s.noteText, { color }]}>{children}</Txt>
    </View>
  );
}

type BtnKind = "gold" | "win" | "dashed";

interface BtnProps {
  label: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  disabled?: boolean;
  /** Nom lu par les lecteurs d'écran, si différent du texte affiché. */
  ariaLabel?: string;
  compact?: boolean;
}

/** Bouton plein (doré ou vert) ou en pointillés. */
export function Btn({ label, onPress, kind = "gold", icon, disabled = false, ariaLabel, compact = false }: BtnProps) {
  const fg = kind === "gold" ? T.bgDeep : kind === "win" ? "#FFFFFF" : T.gold;
  const bg = kind === "gold" ? T.gold : kind === "win" ? T.win : "transparent";
  const border = kind === "gold" ? T.gold : kind === "win" ? T.win : T.line;
  return (
    <Pressable
      role="button"
      aria-label={ariaLabel ?? label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        compact && s.btnCompact,
        { backgroundColor: bg, borderColor: border, borderStyle: kind === "dashed" ? "dashed" : "solid", opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Lien souligné (« Détails », « Actualiser »). */
export function LinkBtn({ label, onPress, color = T.chalkDim, ariaLabel }: { label: string; onPress: () => void; color?: string; ariaLabel?: string }) {
  return (
    <Pressable role="button" aria-label={ariaLabel ?? label} onPress={onPress} hitSlop={8} style={s.link}>
      <Text style={[s.linkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Petit bouton rond ou carré portant seulement une icône ; ariaLabel est donc obligatoire. */
export function IconBtn({
  icon,
  ariaLabel,
  onPress,
  color = T.chalkDim,
  bordered = false,
}: {
  icon: IconName;
  ariaLabel: string;
  onPress: () => void;
  color?: string;
  bordered?: boolean;
}) {
  return (
    <Pressable
      role="button"
      aria-label={ariaLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.iconBtn, bordered && { borderWidth: 1, borderColor: color }, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={16} color={color} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  txt: { color: T.chalk, fontFamily: F.body, fontSize: 14 },
  bold: { fontFamily: F.bodySemi },
  card: { backgroundColor: T.surface, borderColor: T.line, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardAccent: { borderColor: T.gold },
  sectionTitle: { fontFamily: F.titleMedium, fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: T.chalkDim, marginBottom: 10 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  btn: { minHeight: 48, borderRadius: 10, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnCompact: { minHeight: 40, borderRadius: 8, paddingVertical: 6 },
  btnText: { fontFamily: F.bodySemi, fontSize: 15 },
  link: { paddingVertical: 4 },
  linkText: { fontFamily: F.body, fontSize: 13, textDecorationLine: "underline" },
  iconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
