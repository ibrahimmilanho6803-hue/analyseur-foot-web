import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextProps, TextStyle, ViewStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { F, RD, SP, T, alpha } from "./theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

/** Les teintes de l'interface : or (à retenir), vert (bon), rouge (risqué), bleu (information), neutre. */
export type Tone = "gold" | "win" | "loss" | "info" | "neutral";
export const toneColor = (tone: Tone): string => ({ gold: T.gold, win: T.win, loss: T.loss, info: T.info, neutral: T.chalkDim })[tone];

// Briques d'interface communes à tous les écrans.

/** Texte courant. React Native n'impose ni couleur ni police : sans elles, le texte serait noir sur fond vert. */
export function Txt({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[s.txt, style]} />;
}

/** Texte en gras à l'intérieur d'un autre texte (il garde la couleur et la taille du texte qui le contient). */
export function Bold({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[s.bold, style]} />;
}

/** Carte : « accent » pour la carte mise en avant de l'écran (liseré or). */
export function Card({ children, accent = false, style }: { children: React.ReactNode; accent?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, accent && s.cardAccent, style]}>{children}</View>;
}

/** Titre d'un écran (liste de matchs, historique) : pastille dorée portant l'icône, titre, et une phrase d'explication. */
export function ScreenTitle({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  return (
    <View style={s.screenRow}>
      <View style={s.screenIcon}>
        <Feather name={icon} size={20} color={T.gold} />
      </View>
      <View style={s.screenText}>
        <Txt role="heading" style={s.screenName}>
          {title}
        </Txt>
        {subtitle ? <Txt style={s.screenSub}>{subtitle}</Txt> : null}
      </View>
    </View>
  );
}

/** Titre d'une carte : petite icône dorée et titre en capitales. */
export function SectionTitle({ children, icon, right }: { children: React.ReactNode; icon?: IconName; right?: React.ReactNode }) {
  return (
    <View style={s.sectionRow}>
      {icon ? <Feather name={icon} size={17} color={T.gold} /> : null}
      <Txt role="heading" style={s.sectionTitle}>
        {children}
      </Txt>
      {right ? <View style={s.sectionRight}>{right}</View> : null}
    </View>
  );
}

type NoteTone = "warn" | "info" | "ok" | "bad";
const NOTE: Record<NoteTone, { color: string; icon: IconName }> = {
  warn: { color: T.gold, icon: "alert-triangle" },
  info: { color: T.info, icon: "info" },
  ok: { color: T.win, icon: "check-circle" },
  bad: { color: T.loss, icon: "alert-circle" },
};

/** Remarque encadrée : icône colorée selon la gravité, texte lisible. */
export function Note({ children, tone = "warn", style }: { children: React.ReactNode; tone?: NoteTone; style?: StyleProp<ViewStyle> }) {
  const { color, icon } = NOTE[tone];
  return (
    <View style={[s.note, { backgroundColor: alpha(color, 0.09), borderColor: alpha(color, 0.28) }, style]}>
      <Feather name={icon} size={15} color={color} style={s.noteIcon} />
      <Txt style={s.noteText}>{children}</Txt>
    </View>
  );
}

type BtnKind = "primary" | "secondary" | "success" | "ghost";

interface BtnProps {
  label: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  disabled?: boolean;
  /** Nom lu par les lecteurs d'écran, si différent du texte affiché. */
  ariaLabel?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BTN: Record<BtnKind, { bg: string; bgPressed: string; border: string; fg: string }> = {
  primary: { bg: T.gold, bgPressed: T.goldDeep, border: T.gold, fg: T.goldInk },
  success: { bg: T.win, bgPressed: "#2FB87D", border: T.win, fg: "#04241A" },
  secondary: { bg: alpha(T.gold, 0.08), bgPressed: alpha(T.gold, 0.2), border: alpha(T.gold, 0.55), fg: T.gold },
  ghost: { bg: "transparent", bgPressed: alpha(T.chalk, 0.08), border: "transparent", fg: T.chalkDim },
};

/** Bouton : « primary » (action principale, or), « success » (vert), « secondary » (contour or), « ghost » (discret). */
export function Btn({ label, onPress, kind = "primary", icon, disabled = false, ariaLabel, compact = false, style }: BtnProps) {
  const c = BTN[kind];
  return (
    <Pressable
      role="button"
      aria-label={ariaLabel ?? label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.btn, compact && s.btnCompact, { backgroundColor: pressed ? c.bgPressed : c.bg, borderColor: c.border, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {icon ? <Feather name={icon} size={compact ? 16 : 18} color={c.fg} /> : null}
      <Text style={[s.btnText, compact && s.btnTextCompact, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Petit bouton de commande en pastille (« Détails », « Actualiser »). */
export function LinkBtn({ label, onPress, color = T.chalkDim, ariaLabel, icon }: { label: string; onPress: () => void; color?: string; ariaLabel?: string; icon?: IconName }) {
  return (
    <Pressable
      role="button"
      aria-label={ariaLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.link, { borderColor: alpha(color, 0.35), backgroundColor: pressed ? alpha(color, 0.16) : alpha(color, 0.06) }]}
    >
      {icon ? <Feather name={icon} size={14} color={color} /> : null}
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
      hitSlop={4}
      style={({ pressed }) => [
        s.iconBtn,
        bordered && { borderWidth: 1, borderColor: alpha(color, 0.5), backgroundColor: alpha(color, 0.1) },
        pressed && { backgroundColor: alpha(color, 0.22) },
      ]}
    >
      <Feather name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Pastille de texte : « tone » la teinte, « solid » pour un fond plein (verdict), « icon » facultatif. */
export function Badge({ label, tone = "neutral", icon, solid = false, style }: { label: string; tone?: Tone; icon?: IconName; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  const color = toneColor(tone);
  const fg = solid ? T.goldInk : color;
  return (
    <View style={[s.badge, solid ? { backgroundColor: color } : { backgroundColor: alpha(color, 0.13), borderColor: alpha(color, 0.35), borderWidth: 1 }, style]}>
      {icon ? <Feather name={icon} size={12} color={fg} /> : null}
      <Text style={[s.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Barre de probabilité (value de 0 à 1). Purement visuelle : le pourcentage est toujours écrit à côté. */
export function ProbBar({ value, color, height = 6, style }: { value: number; color: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const share = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={[{ height, borderRadius: height / 2, backgroundColor: alpha(T.chalk, 0.09), overflow: "hidden" }, style]}>
      <View style={{ width: `${Math.round(share * 100)}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Niveau de confiance en trois barres (faible, moyen, élevé). Purement visuel : le niveau est écrit à côté. */
export function Meter({ level, color }: { level: 0 | 1 | 2 | 3; color: string }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={s.meter}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[s.meterBar, { height: 5 + i * 3, backgroundColor: i <= level ? color : alpha(T.chalk, 0.16) }]} />
      ))}
    </View>
  );
}

/** Zone en relief à l'intérieur d'une carte : un petit titre en capitales et son contenu. */
export function Tile({ label, children, style }: { label: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tile, style]}>
      <Txt style={s.tileLabel}>{label}</Txt>
      {children}
    </View>
  );
}

/** Écran sans contenu : icône, titre, explication. */
export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Feather name={icon} size={24} color={T.chalkDim} />
      </View>
      <Txt style={s.emptyTitle}>{title}</Txt>
      {text ? <Txt style={s.emptyText}>{text}</Txt> : null}
    </View>
  );
}

/** Style d'un grand chiffre (pourcentage, cote) : Oswald, chiffres de largeur fixe. */
export const bigNumber = (size: number, color: string): TextStyle => ({ fontFamily: F.title, fontSize: size, lineHeight: Math.round(size * 1.15), color, fontVariant: ["tabular-nums"] });

const s = StyleSheet.create({
  txt: { color: T.chalk, fontFamily: F.body, fontSize: 14 },
  bold: { fontFamily: F.bodySemi },
  card: { backgroundColor: T.surface, borderColor: T.line, borderWidth: 1, borderRadius: RD.lg, padding: SP.lg, marginBottom: SP.md },
  cardAccent: { borderColor: alpha(T.gold, 0.5) },
  screenRow: { flexDirection: "row", alignItems: "flex-start", gap: SP.md, marginBottom: SP.md },
  screenIcon: { width: 42, height: 42, borderRadius: RD.md, alignItems: "center", justifyContent: "center", backgroundColor: alpha(T.gold, 0.13), borderWidth: 1, borderColor: alpha(T.gold, 0.35) },
  screenText: { flex: 1, minWidth: 0 },
  screenName: { fontFamily: F.titleMedium, fontSize: 21, lineHeight: 27, textTransform: "uppercase", letterSpacing: 0.8, color: T.chalk },
  screenSub: { fontSize: 13, lineHeight: 19, color: T.chalkDim, marginTop: 2 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.md },
  sectionTitle: { flexShrink: 1, fontFamily: F.titleMedium, fontSize: 16, lineHeight: 22, textTransform: "uppercase", letterSpacing: 1, color: T.chalk },
  sectionRight: { marginLeft: "auto" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: SP.sm, marginTop: SP.sm, paddingVertical: SP.sm, paddingHorizontal: SP.md, borderRadius: RD.md, borderWidth: 1 },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: T.chalk },
  btn: { minHeight: 50, borderRadius: RD.md, borderWidth: 1.5, paddingHorizontal: SP.lg, paddingVertical: SP.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm },
  btnCompact: { minHeight: 42, borderRadius: 10, paddingVertical: 6 },
  btnText: { fontFamily: F.bodySemi, fontSize: 15 },
  btnTextCompact: { fontSize: 14 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34, paddingHorizontal: SP.md, borderRadius: RD.pill, borderWidth: 1 },
  linkText: { fontFamily: F.bodyMedium, fontSize: 13 },
  iconBtn: { width: 40, height: 40, borderRadius: RD.md, alignItems: "center", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: RD.pill },
  badgeText: { fontFamily: F.bodySemi, fontSize: 12 },
  meter: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 14 },
  meterBar: { width: 4, borderRadius: 2 },
  tile: { flex: 1, backgroundColor: T.raised, borderRadius: RD.md, borderWidth: 1, borderColor: T.line, paddingVertical: SP.md, paddingHorizontal: SP.md, gap: 4 },
  tileLabel: { fontFamily: F.bodySemi, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase", color: T.chalkDim },
  empty: { alignItems: "center", paddingVertical: SP.xl, gap: SP.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.raised, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: F.bodySemi, fontSize: 16 },
  emptyText: { fontSize: 13, lineHeight: 19, color: T.chalkDim, textAlign: "center", maxWidth: 280 },
});
