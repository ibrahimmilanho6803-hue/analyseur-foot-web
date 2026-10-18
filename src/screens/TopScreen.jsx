import React from "react";
import { Check, Eye, EyeOff, Plus, RefreshCw, Search, Star, Zap } from "lucide-react";
import { canonicalLabel } from "../betTypes";
import { asCross, asRefund, confidenceLabel, confidenceLevel, crossLeagueNote, refundNote } from "../estimates";
import { formatDate } from "../format";
import { Btn, Card, ChipBtn, Icon, Meter, Note, ProbBar, ScreenTitle, Spinner, Tile, probTone } from "../ui";

function MatchCard({ match, first, showDetails, added, onAdd }) {
  const cross = asCross(match.comparaisonEntreChampionnats); // clubs de championnats différents (Ligue des champions…)
  const refund = asRefund(match.remboursement);
  const tone = probTone(match.probabilite);
  return (
    <Card as="article" accent={first} className={`match tone-${tone}`}>
      <div className="match__head">
        <div className="match__comp tone-gold">
          {first ? <Icon icon={Star} size={16} fill="currentColor" style={{ color: "var(--gold)" }} /> : null}
          {match.competition ? <span className="chip">{match.competition}</span> : null}
        </div>
        <span className="match__date">{formatDate(match.date)}</span>
      </div>

      <h3 className="match__teams">{match.homeTeam} vs {match.awayTeam}</h3>

      <div className="pick">
        <div className="pick__main">
          <p className="pick__label">Pari conseillé</p>
          <p className="pick__name">{canonicalLabel(match.meilleurPari)}</p>
        </div>
        {typeof match.coteEstimee === "number" ? (
          <div className="pick__odds">
            <p className="pick__label">Cote estimée</p>
            <p className="pick__odds-value">{match.coteEstimee.toFixed(2)}</p>
          </div>
        ) : null}
      </div>

      <div className="match__prob-row">
        <span className="match__prob">{match.probabilite} %</span>
        <div className="match__side">
          <ProbBar value={match.probabilite / 100} tone={tone} height={8} />
          <div className="match__confidence">
            <Meter level={confidenceLevel(match.niveauConfiance)} tone={tone} />
            <span>Confiance : {confidenceLabel(match.niveauConfiance)}</span>
          </div>
        </div>
      </div>

      {cross ? <Note>{crossLeagueNote(cross)}</Note> : null}
      {refund ? <Note tone="info">{refundNote(refund)}</Note> : null}
      {showDetails && match.justification ? <p className="match__reason">{match.justification}</p> : null}
      {showDetails && match.vigilance ? <Note>À surveiller : {match.vigilance}</Note> : null}
      <div className="match__spacer" />
      <Btn kind={added ? "secondary" : "primary"} icon={added ? Check : Plus} compact onClick={onAdd} disabled={added} style={{ marginTop: 14 }}>
        {added ? "Déjà dans le coupon" : "Ajouter ce pronostic"}
      </Btn>
    </Card>
  );
}

// Onglet « Top Matchs » : les meilleurs matchs à venir, choisis et analysés par le serveur.
export default function TopScreen({ c }) {
  const { topMatches, topMeta, topLoading, topError, topAt, showDetails } = c;
  const iaDown = Boolean(topMeta && topMeta.ia && (topMeta.ia.statut === "indisponible" || topMeta.ia.statut === "partielle"));
  const iaOff = Boolean(topMeta && topMeta.ia && topMeta.ia.statut === "desactivee");
  const nb = topMeta ? topMeta.nbChampionnats : null;
  const nbCups = topMeta && topMeta.nbCoupes ? topMeta.nbCoupes : 0;
  const scope = nb ? `${nb} championnat${nb > 1 ? "s" : ""}${nbCups > 0 ? ` et ${nbCups} coupe${nbCups > 1 ? "s" : ""} d'Europe` : ""}` : "";
  const subtitle = nb ? `Analyse de ${scope}, matchs des ${topMeta.fenetreHeures} prochaines heures.` : "Analyse des championnats couverts par le serveur.";

  return (
    <div>
      <ScreenTitle icon={Zap} title="Top 3 Matchs à venir" subtitle={subtitle} />

      <div className="toolbar">
        {!topLoading && (topAt > 0 || topError) ? <ChipBtn tone="gold" icon={RefreshCw} onClick={c.fetchTopMatches}>Actualiser</ChipBtn> : null}
        {topMatches.length > 0 ? <ChipBtn icon={showDetails ? EyeOff : Eye} onClick={c.toggleDetails}>{showDetails ? "Masquer" : "Détails"}</ChipBtn> : null}
      </div>

      {topLoading ? (
        <Card>
          <div className="progress progress--center" role="status">
            <Spinner large />
            <span>Analyse des matchs en cours… (jusqu'à une minute)</span>
          </div>
        </Card>
      ) : null}
      {topError ? <Note tone="bad">{topError}</Note> : null}
      {!topLoading && topMeta && topMeta.message ? <Note>{topMeta.message}</Note> : null}
      {!topLoading && iaDown ? <Note>La relecture par l'IA n'a pas pu être faite pour tous les matchs : ces probabilités viennent du modèle statistique seul.</Note> : null}
      {!topLoading && iaOff ? <Note>La relecture par l'IA est désactivée sur le serveur : probabilités du modèle statistique seul.</Note> : null}
      {!topLoading && topMeta && topMeta.perime ? <Note>Sélection précédente conservée : les données n'ont pas pu être actualisées.</Note> : null}
      {!topLoading && topMeta && topMeta.complet === false ? <Note>Certains championnats sont encore en cours de chargement : la sélection peut évoluer dans quelques minutes.</Note> : null}
      {!topLoading && topMeta && topMeta.avertissementDonnees ? <Note>{topMeta.avertissementDonnees}</Note> : null}

      {!topLoading && topMatches.length > 0 && topMeta ? (
        <Card className="summary" style={{ marginTop: 14 }}>
          <div className="summary__tiles">
            <Tile label="Cote combinée estimée">
              <span className="tile__value summary__value--gold">{topMeta.coteTotale}</span>
            </Tile>
            <Tile label="Probabilité combinée">
              <span className="tile__value">{topMeta.probabiliteCombinee} %</span>
            </Tile>
          </div>
          {topMeta.avertissement ? <Note tone="info">{topMeta.avertissement}</Note> : null}
        </Card>
      ) : null}

      <div className="match-grid">
        {topMatches.map((match, i) => (
          <MatchCard key={String(match.id ?? i)} match={match} first={i === 0} showDetails={showDetails} added={c.isInDraft(match)} onAdd={() => c.addTopMatchToDraft(match)} />
        ))}
      </div>

      {!topLoading && topAt === 0 && topMatches.length === 0 && !topError ? (
        <Btn icon={Search} onClick={c.fetchTopMatches}>Chercher les meilleurs matchs</Btn>
      ) : null}
    </div>
  );
}
