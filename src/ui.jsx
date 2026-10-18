import React from "react";
import { AlertTriangle, CircleAlert, CircleCheck, Info } from "lucide-react";

// Briques d'interface communes à tous les écrans. Les styles sont dans styles.css.

const cx = (...names) => names.filter(Boolean).join(" ");

/** Couleur d'une probabilité (en %) : vert quand elle est solide, or quand elle est moyenne, rouge quand le pari est risqué. */
export const probTone = (percent) => (percent >= 70 ? "win" : percent >= 50 ? "gold" : "loss");

/** Icône décorative : jamais lue par les lecteurs d'écran (le texte à côté dit la même chose). */
export function Icon({ icon: Glyph, size = 18, ...rest }) {
  return <Glyph size={size} aria-hidden="true" focusable="false" {...rest} />;
}

/** Carte : « accent » pour la carte mise en avant de l'écran (liseré or). */
export function Card({ accent = false, as: Tag = "section", className, children, ...rest }) {
  return <Tag className={cx("card", accent && "card--accent", className)} {...rest}>{children}</Tag>;
}

/** Titre d'un écran : pastille dorée portant l'icône, titre, et une phrase d'explication. */
export function ScreenTitle({ icon, title, subtitle }) {
  return (
    <div className="screen-title">
      <span className="screen-title__icon"><Icon icon={icon} size={22} /></span>
      <div>
        <h2 className="screen-title__name">{title}</h2>
        {subtitle ? <p className="screen-title__sub">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** Titre d'une carte : petite icône dorée et titre en capitales. */
export function SectionTitle({ icon, children, right }) {
  return (
    <h2 className="section-title">
      {icon ? <Icon icon={icon} size={18} /> : null}
      <span>{children}</span>
      {right ? <span className="section-title__right">{right}</span> : null}
    </h2>
  );
}

const NOTE = {
  warn: { tone: "gold", icon: AlertTriangle },
  info: { tone: "info", icon: Info },
  ok: { tone: "win", icon: CircleCheck },
  bad: { tone: "loss", icon: CircleAlert },
};

/** Remarque encadrée : icône colorée selon la gravité, texte lisible. */
export function Note({ tone = "warn", className, children }) {
  const { tone: color, icon } = NOTE[tone];
  return (
    <div className={cx("note", `tone-${color}`, className)} role={tone === "bad" ? "alert" : undefined}>
      <Icon icon={icon} size={16} />
      <span className="note__text">{children}</span>
    </div>
  );
}

/** Bouton : « primary » (action principale, or), « success » (vert), « secondary » (contour or). */
export function Btn({ kind = "primary", icon, compact = false, className, children, ...rest }) {
  return (
    <button type="button" className={cx("btn", kind !== "primary" && `btn--${kind}`, compact && "btn--compact", className)} {...rest}>
      {icon ? <Icon icon={icon} size={compact ? 16 : 18} /> : null}
      <span>{children}</span>
    </button>
  );
}

/** Petit bouton de commande en pastille (« Détails », « Actualiser »). */
export function ChipBtn({ tone = "dim", icon, children, ...rest }) {
  return (
    <button type="button" className={cx("chip-btn", `tone-${tone}`)} {...rest}>
      {icon ? <Icon icon={icon} size={14} /> : null}
      <span>{children}</span>
    </button>
  );
}

/** Petit bouton portant seulement une icône ; label est donc obligatoire (nom lu par les lecteurs d'écran). */
export function IconBtn({ icon, label, tone = "dim", bordered = false, size = 18, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx("icon-btn", `tone-${tone}`, bordered && "icon-btn--bordered")} {...rest}>
      <Icon icon={icon} size={size} />
    </button>
  );
}

/** Pastille de texte : « tone » la teinte, « solid » pour un fond plein (verdict), « icon » facultatif. */
export function Badge({ tone = "dim", solid = false, icon, children }) {
  return (
    <span className={cx("badge", `tone-${tone}`, solid && "badge--solid")}>
      {icon ? <Icon icon={icon} size={13} /> : null}
      {children}
    </span>
  );
}

/** Barre de probabilité (value de 0 à 1). Purement visuelle : le pourcentage est toujours écrit à côté. */
export function ProbBar({ value, tone = "gold", height = 6, className }) {
  const share = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className={cx("prob-bar", `tone-${tone}`, className)} aria-hidden="true" style={{ "--h": `${height}px`, "--w": `${Math.round(share * 100)}%` }}>
      <div className="prob-bar__fill" />
    </div>
  );
}

/** Niveau de confiance en trois barres (0 à 3). Purement visuel : le niveau est écrit à côté. */
export function Meter({ level, tone = "gold" }) {
  return (
    <span className={cx("meter", `tone-${tone}`)} aria-hidden="true">
      {[1, 2, 3].map((i) => <i key={i} className={i <= level ? "on" : undefined} />)}
    </span>
  );
}

/** Zone en relief à l'intérieur d'une carte : un petit titre et son contenu. */
export function Tile({ label, children }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      {children}
    </div>
  );
}

/** Écran sans contenu : icône, titre, explication. */
export function EmptyState({ icon, title, children }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon icon={icon} size={26} /></span>
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__text">{children}</p> : null}
    </div>
  );
}

export function Spinner({ large = false }) {
  return <span className={cx("spinner", large && "spinner--lg")} aria-hidden="true" />;
}
