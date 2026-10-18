import React from "react";
import { Check, CircleCheck, CircleX, Clock, History, Inbox, Trash2, X } from "lucide-react";
import { REFUND_WHEN, canonicalLabel } from "../betTypes";
import { formatDay } from "../format";
import { Badge, Card, EmptyState, IconBtn, ScreenTitle } from "../ui";

// Pastille d'un pari déjà joué : « V » (gagné) ou « X » (perdu).
function Result({ won }) {
  return <span className={`hist__result ${won ? "tone-win" : "tone-loss"}`}>{won ? "V" : "X"}</span>;
}

function Row({ p, c }) {
  const pending = p.statut === "en_attente";
  const bet = canonicalLabel(p.typePari);
  const rule = REFUND_WHEN[bet];
  return (
    <div className="hist__row">
      <div className="hist__main">
        <p className="hist__text">{`${p.equipe1} vs ${p.equipe2} - ${bet}`}</p>
        {pending && rule ? <p className="hist__hint">Remboursé si {rule} : dans ce cas, supprimez ce pari.</p> : null}
      </div>
      {pending ? (
        <div className="hist__actions">
          <IconBtn icon={Check} label="Marquer comme gagné" tone="win" bordered onClick={() => c.setSelStatut(p.id, "gagne")} />
          <IconBtn icon={X} label="Marquer comme perdu" tone="loss" bordered onClick={() => c.setSelStatut(p.id, "perdu")} />
        </div>
      ) : (
        <Result won={p.statut === "gagne"} />
      )}
      <IconBtn icon={Trash2} label="Supprimer ce pari" onClick={() => c.removeSel(p.id)} />
    </div>
  );
}

// Onglet « Historique » : les coupons enregistrés, du plus récent au plus ancien. Chaque pari se marque gagné ou perdu une fois le match joué.
export default function HistoryScreen({ c }) {
  const { coupons } = c;
  return (
    <div>
      <ScreenTitle icon={History} title="Historique" subtitle={coupons.length > 0 ? "Marquez chaque pari gagné ou perdu une fois le match joué." : undefined} />
      {coupons.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="Aucun coupon">
            Enregistrez un coupon depuis l'onglet « Mon coupon » : il apparaîtra ici.
          </EmptyState>
        </Card>
      ) : null}
      <div className="history-grid">
        {coupons.map((group) => {
          const allDone = group.every((p) => p.statut !== "en_attente");
          const won = allDone && group.every((p) => p.statut === "gagne");
          const tone = !allDone ? "gold" : won ? "win" : "loss";
          return (
            <Card key={group[0].couponId || group[0].id} className={`hist tone-${tone}`}>
              <div className="hist__head">
                <span className="hist__date">{formatDay(group[0].date)}</span>
                <Badge tone={tone} icon={!allDone ? Clock : won ? CircleCheck : CircleX}>{!allDone ? "En attente" : won ? "Gagné" : "Perdu"}</Badge>
              </div>
              {group.map((p) => <Row key={p.id} p={p} c={c} />)}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
