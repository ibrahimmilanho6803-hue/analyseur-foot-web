import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Search, Target, X } from "lucide-react";
import { groupOf, searchGroups } from "./betSearch";
import { BET_GROUPS, REFUND_WHEN, canonicalLabel } from "./betTypes";
import { Icon, IconBtn, Note } from "./ui";

const slug = (text) => text.replace(/[^a-z0-9]+/gi, "-");

// Choix du type de pari : un champ qui ouvre une fenêtre (en bas de l'écran sur téléphone, au centre sur grand écran). Une centaine de
// paris y sont regroupés par famille : les familles se déplient une à la fois (celle du pari actuel est ouverte), et une recherche
// (« plus de 2.5 », « nul ») les parcourt toutes.
export default function BetPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const baseId = useId();
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const groupRefs = useRef({});
  const toReveal = useRef(null); // famille à ramener en haut de la liste dès qu'elle est dépliée
  const wasOpen = useRef(false);

  const searching = query.trim().length > 0;
  const groups = useMemo(() => (searching ? searchGroups(query) : BET_GROUPS), [query, searching]);
  const current = canonicalLabel(value);
  const refund = REFUND_WHEN[current];

  const show = () => {
    const group = groupOf(value);
    setQuery("");
    setExpanded(group);
    toReveal.current = group;
    setOpen(true);
  };
  const close = () => setOpen(false);
  const toggle = (title) => {
    const opening = expanded !== title;
    setExpanded(opening ? title : null);
    toReveal.current = opening ? title : null;
  };
  const choose = (type) => {
    onChange(type);
    close();
  };

  // À l'ouverture : la page derrière ne défile plus, et le focus entre dans la fenêtre. Sur téléphone on ne met pas le curseur dans la
  // recherche (le clavier cacherait la liste) ; avec une souris, si. À la fermeture, le focus revient au champ.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current && triggerRef.current) triggerRef.current.focus();
      wasOpen.current = false;
      return undefined;
    }
    wasOpen.current = true;
    const body = document.body;
    const before = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const bar = window.innerWidth - document.documentElement.clientWidth; // largeur de l'ascenseur : évite un saut de la page
    body.style.overflow = "hidden";
    if (bar > 0) body.style.paddingRight = `${bar}px`;
    const finePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
    const target = finePointer ? searchRef.current : sheetRef.current;
    if (target) target.focus();
    return () => {
      body.style.overflow = before.overflow;
      body.style.paddingRight = before.paddingRight;
    };
  }, [open]);

  // Quand une famille se déplie, les autres se replient : on la remonte en haut de la liste pour qu'elle ne parte pas hors de l'écran.
  useEffect(() => {
    const title = toReveal.current;
    if (!open || !title) return;
    toReveal.current = null;
    const el = groupRefs.current[title];
    if (el && listRef.current) listRef.current.scrollTop = Math.max(0, el.offsetTop - 4);
  }, [open, expanded]);

  // Échap ferme ; Tab reste dans la fenêtre.
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const items = Array.from(sheetRef.current.querySelectorAll("button:not(:disabled), input"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = `${baseId}-title`;

  return (
    <div className="field">
      <span className="field__label">Type de pari</span>
      <button ref={triggerRef} type="button" className="control control--button" aria-haspopup="dialog" aria-expanded={open} aria-label={`Type de pari : ${value}`} onClick={show}>
        <Icon icon={Target} />
        <span className="control__value">{value}</span>
        <Icon icon={ChevronDown} size={20} />
      </button>
      {refund ? <Note tone="info">Ligne entière : remboursé si {refund}.</Note> : null}

      {open
        ? createPortal(
            <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
              <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
                <div className="sheet__grabber" aria-hidden="true" />
                <div className="sheet__head">
                  <h2 id={titleId} className="sheet__title">Type de pari</h2>
                  <IconBtn icon={X} label="Fermer" onClick={close} />
                </div>

                <div className="control">
                  <Icon icon={Search} />
                  <input
                    ref={searchRef}
                    type="search"
                    className="control__input"
                    aria-label="Rechercher un pari"
                    placeholder="Rechercher (ex. plus de 2.5, nul…)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                  {query ? <IconBtn icon={X} label="Effacer la recherche" onClick={() => { setQuery(""); if (searchRef.current) searchRef.current.focus(); }} /> : null}
                </div>

                <div ref={listRef} className="sheet__list">
                  {groups.length === 0 ? <p className="sheet__empty">Aucun pari ne correspond à « {query.trim()} ».</p> : null}
                  {groups.map((group) => {
                    const isOpen = searching || expanded === group.title;
                    const holdsValue = group.types.includes(current);
                    const head = (
                      <>
                        <span className="group__title">{group.title}</span>
                        {holdsValue && !isOpen ? <span className="group__dot" title="Contient le pari choisi" /> : null}
                        <span className="group__count">{group.types.length}</span>
                        {searching ? null : <Icon icon={isOpen ? ChevronUp : ChevronDown} size={18} />}
                      </>
                    );
                    return (
                      <div key={group.title} ref={(el) => { groupRefs.current[group.title] = el; }} className={isOpen ? "group group--open" : "group"}>
                        <h3 className="group__heading">
                          {searching ? (
                            <span className="group__head">{head}</span>
                          ) : (
                            <button type="button" className="group__head" aria-expanded={isOpen} aria-label={group.title} onClick={() => toggle(group.title)}>
                              {head}
                            </button>
                          )}
                        </h3>
                        {isOpen ? (
                          <div role="radiogroup" aria-label={group.title}>
                            {group.types.map((type) => {
                              const selected = type === current;
                              const rule = REFUND_WHEN[type];
                              const ruleId = `${baseId}-rule-${slug(type)}`;
                              return (
                                <button key={type} type="button" role="radio" aria-checked={selected} aria-label={type} aria-describedby={rule ? ruleId : undefined} className="option" onClick={() => choose(type)}>
                                  <span className="option__radio" aria-hidden="true" />
                                  <span className="option__body">
                                    {type}
                                    {rule ? <span id={ruleId} className="option__rule">Remboursé si {rule}</span> : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
