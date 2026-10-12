import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { canon, suggest } from "../suggest";
import type { IndexedTeam, Suggestion } from "../suggest";
import { F, T, alpha } from "../theme";
import { Txt } from "../ui";

interface Props {
  /** Nom lu par les lecteurs d'écran ; sert aussi de titre visible au-dessus du champ. */
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Liste préparée par buildIndex (ou null tant qu'elle n'est pas connue). */
  index: IndexedTeam[] | null;
  /** Vrai quand tous les championnats suivis sont dans la liste. */
  complete?: boolean;
  /** Appelé quand le champ prend le focus (le parent peut alors rafraîchir la liste). */
  onFocus?: () => void;
}

// Champ de saisie d'un club avec suggestions. La liste s'affiche sous le champ, dans la page (pas par-dessus) : sur Android,
// un élément qui dépasse de son parent ne reçoit pas les appuis. Sans liste de clubs (serveur injoignable, chargement en cours),
// c'est un champ texte ordinaire : le serveur reconnaît de toute façon le nom saisi.
export default function TeamInput({ label, placeholder, value, onChange, index, complete = true, onFocus }: Props) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (index ? suggest(index, value) : []), [index, value]);
  const showList = open && results.length > 0;
  const showHint = open && Boolean(index) && results.length === 0 && canon(value).length >= 3;

  const pick = (team: Suggestion) => {
    onChange(team.nom);
    setOpen(false);
  };

  return (
    <View style={s.wrap}>
      <Txt style={s.label}>{label}</Txt>
      <TextInput
        aria-label={label}
        aria-expanded={showList}
        placeholder={placeholder}
        placeholderTextColor={T.chalkDim}
        selectionColor={T.gold}
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (onFocus) onFocus();
        }}
        onBlur={() => setOpen(false)}
        autoCapitalize="words"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType="done"
        style={s.input}
      />
      {showList ? (
        <View role="list" aria-label="Suggestions de clubs" style={s.dropdown}>
          {results.map((r) => (
            <Pressable
              key={r.nom}
              role="option"
              aria-label={[r.nom, r.via, r.ligue].filter(Boolean).join(", ")}
              onPress={() => pick(r)}
              style={({ pressed }) => [s.option, pressed && { backgroundColor: alpha(T.gold, 0.13) }]}
            >
              <Text style={s.optionName}>{r.nom}</Text>
              {r.via || r.ligue ? <Text style={s.optionSub}>{[r.via, r.ligue].filter(Boolean).join(" · ")}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {showHint ? (
        <View role="status" style={s.hint}>
          <Text style={s.hintText}>
            {complete
              ? "Aucun club suivi ne correspond : vérifiez l'orthographe."
              : "Aucun club trouvé pour l'instant : certains championnats sont encore en chargement. Vous pouvez saisir le nom librement."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, color: T.chalkDim, marginBottom: 4 },
  input: {
    backgroundColor: T.bgDeep,
    borderColor: T.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 48,
    color: T.chalk,
    fontFamily: F.body,
    fontSize: 16,
  },
  dropdown: { marginTop: 4, backgroundColor: T.bgDeep, borderColor: T.gold, borderWidth: 1, borderRadius: 8, padding: 4 },
  option: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 6, minHeight: 48, justifyContent: "center" },
  optionName: { color: T.chalk, fontFamily: F.bodySemi, fontSize: 15 },
  optionSub: { color: T.chalkDim, fontFamily: F.body, fontSize: 12, marginTop: 1 },
  hint: { marginTop: 4, backgroundColor: T.bgDeep, borderColor: T.gold, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  hintText: { color: T.gold, fontFamily: F.body, fontSize: 12, lineHeight: 17 },
});
