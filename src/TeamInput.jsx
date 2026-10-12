import React, { useId, useMemo, useState } from "react";
import { T, inputStyle } from "./theme";
import { canon, suggest } from "./suggest";

const hidden = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

const dropdown = {
  position: "absolute", left: 0, right: 0, top: "100%", marginTop: 2, zIndex: 30, background: T.surface, border: `1px solid ${T.gold}`,
  borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.45)", fontSize: 13,
};

// Champ de saisie d'un club avec suggestions (liste déroulante accessible : flèches, Entrée, Échap). Sans liste de clubs (serveur
// injoignable, chargement en cours), c'est un champ texte ordinaire : le serveur reconnaît de toute façon le nom saisi.
//   index    : liste préparée par buildIndex (ou null)
//   complete : vrai quand tous les championnats suivis sont dans la liste
//   onFocus  : appelé quand le champ prend le focus (le parent peut alors rafraîchir la liste)
export default function TeamInput({ label, placeholder, value, onChange, index, complete = true, onFocus }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = useMemo(() => (index ? suggest(index, value) : []), [index, value]);
  const showList = open && results.length > 0;
  const showHint = open && index && results.length === 0 && canon(value).length >= 3;

  const pick = (team) => {
    onChange(team.nom);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      if (!open) { setOpen(true); setActive(e.key === "ArrowDown" ? 0 : results.length - 1); return; }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? (step > 0 ? 0 : results.length - 1) : (a + step + results.length) % results.length));
    } else if (e.key === "Enter" && showList && active >= 0 && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => { setOpen(true); if (onFocus) onFocus(); }}
        onBlur={() => { setOpen(false); setActive(-1); }}
        onKeyDown={onKeyDown}
        style={inputStyle()}
      />
      <span role="status" style={hidden}>{showList ? `${results.length} suggestion${results.length > 1 ? "s" : ""}` : ""}</span>
      {showList && (
        <ul id={listId} role="listbox" aria-label="Suggestions de clubs" style={{ ...dropdown, listStyle: "none", margin: "2px 0 0", padding: 4, maxHeight: 280, overflowY: "auto" }}>
          {results.map((s, i) => (
            <li
              key={s.nom}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown ne doit pas retirer le focus du champ : sinon la liste se refermerait avant le clic
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              style={{ padding: "9px 10px", borderRadius: 6, cursor: "pointer", lineHeight: 1.25, background: i === active ? `${T.gold}22` : "transparent" }}
            >
              <div style={{ fontWeight: 600 }}>{s.nom}</div>
              {(s.via || s.ligue) && <div style={{ fontSize: 10, color: T.chalkDim }}>{[s.via, s.ligue].filter(Boolean).join(" · ")}</div>}
            </li>
          ))}
        </ul>
      )}
      {showHint && (
        <div role="status" style={{ ...dropdown, padding: "8px 10px", color: T.gold, fontSize: 11, lineHeight: 1.35 }}>
          {complete
            ? "Aucun club suivi ne correspond : vérifiez l'orthographe."
            : "Aucun club trouvé pour l'instant : certains championnats sont encore en chargement. Vous pouvez saisir le nom librement."}
        </div>
      )}
    </div>
  );
}
