import React, { useId, useMemo, useRef, useState } from "react";
import { Shield, X } from "lucide-react";
import { canon, suggest } from "./suggest";
import { Icon, IconBtn } from "./ui";

// Champ de saisie d'un club avec suggestions (liste déroulante accessible : flèches, Entrée, Échap). Sans liste de clubs (serveur
// injoignable, chargement en cours), c'est un champ texte ordinaire : le serveur reconnaît de toute façon le nom saisi.
//   label    : titre visible au-dessus du champ, et nom lu par les lecteurs d'écran
//   icon     : petite icône au début du champ (domicile, extérieur)
//   index    : liste préparée par buildIndex (ou null)
//   complete : vrai quand tous les championnats suivis sont dans la liste
//   onFocus  : appelé quand le champ prend le focus (le parent peut alors rafraîchir la liste)
export default function TeamInput({ label, placeholder, value, onChange, index, complete = true, onFocus, icon = Shield }) {
  const listId = useId();
  const inputRef = useRef(null);
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
    <div className="field">
      <label className="field__label" htmlFor={`${listId}-input`}>{label}</label>
      <div className="control">
        <Icon icon={icon} />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          className="control__input"
          type="text"
          role="combobox"
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
        />
        {value ? (
          <IconBtn
            icon={X}
            label={`Effacer ${label}`}
            // mousedown ne doit pas retirer le focus du champ
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setActive(-1); if (inputRef.current) inputRef.current.focus(); }}
          />
        ) : null}
      </div>
      <span role="status" className="visually-hidden">{showList ? `${results.length} suggestion${results.length > 1 ? "s" : ""}` : ""}</span>
      {showList && (
        <ul id={listId} role="listbox" aria-label="Suggestions de clubs" className="suggest">
          {results.map((s, i) => (
            <li
              key={s.nom}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="suggest__item"
              // mousedown ne doit pas retirer le focus du champ : sinon la liste se refermerait avant le clic
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
            >
              <div className="suggest__name">{s.nom}</div>
              {(s.via || s.ligue) && <div className="suggest__sub">{[s.via, s.ligue].filter(Boolean).join(" · ")}</div>}
            </li>
          ))}
        </ul>
      )}
      {showHint && (
        <div role="status" className="suggest-hint">
          {complete
            ? "Aucun club suivi ne correspond : vérifiez l'orthographe."
            : "Aucun club trouvé pour l'instant : certains championnats sont encore en chargement. Vous pouvez saisir le nom librement."}
        </div>
      )}
    </div>
  );
}
