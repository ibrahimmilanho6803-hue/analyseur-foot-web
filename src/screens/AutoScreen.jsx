import React from "react";
import { ArrowRight, Cpu, House, ListChecks, MapPin, Plus, Trash2, Zap } from "lucide-react";
import TeamInput from "../TeamInput";
import { Btn, Card, ChipBtn, EmptyState, IconBtn, Note, SectionTitle, Spinner } from "../ui";

// Onglet « Auto » : on saisit des matchs, le serveur choisit un pari par match pour atteindre la cote visée. Sur grand écran, la saisie est à gauche
// et la liste des matchs à droite ; sur téléphone, tout s'enchaîne dans une seule colonne.
export default function AutoScreen({ c }) {
  const { genForm, catalog, matchesToGenerate, genReport, genLoading } = c;
  const empty = matchesToGenerate.length === 0;
  const found = Boolean(genReport && genReport.added > 0);

  return (
    <Card className="auto-layout">
      <div className="auto-layout__form">
        <SectionTitle icon={Cpu}>Génération automatique</SectionTitle>
        <p className="intro">
          Saisissez au moins 3 matchs : le serveur choisit pour chacun un pari de façon que la cote totale du coupon atteigne 5, avec des paris aussi fiables que possible. L'équipe 1 reçoit, l'équipe 2 se déplace.
          Les deux clubs peuvent venir de championnats différents (Ligue des champions, par exemple) : l'estimation est alors moins précise.
        </p>

        <TeamInput
          label="Équipe 1 du match à générer"
          placeholder="Équipe 1"
          icon={House}
          value={genForm.equipe1}
          onChange={(v) => c.setGenForm((f) => ({ ...f, equipe1: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <TeamInput
          label="Équipe 2 du match à générer"
          placeholder="Équipe 2"
          icon={MapPin}
          value={genForm.equipe2}
          onChange={(v) => c.setGenForm((f) => ({ ...f, equipe2: v }))}
          index={catalog.index}
          complete={catalog.complete}
          onFocus={catalog.refresh}
        />
        <Btn kind="secondary" icon={Plus} onClick={c.addMatchToGenerate}>Ajouter</Btn>
      </div>

      <div className="auto-layout__list">
        {empty ? (
          <div className="auto-empty">
            <EmptyState icon={ListChecks} title="Aucun match à générer">
              Ajoutez au moins 3 matchs avec le formulaire : le serveur choisira un pari par match pour atteindre une cote totale de 5.
            </EmptyState>
          </div>
        ) : (
          <>
            <SectionTitle icon={ListChecks}>{`Matchs à générer (${matchesToGenerate.length})`}</SectionTitle>
            <ol className="gen-list" aria-label="Matchs à générer">
              {matchesToGenerate.map((m, i) => (
                <li key={m.id} className="gen-item">
                  <span className="gen-item__rank" aria-hidden="true">{i + 1}</span>
                  <span className="gen-item__text">{m.equipe1} vs {m.equipe2}</span>
                  <IconBtn icon={Trash2} label={`Retirer ${m.equipe1} vs ${m.equipe2}`} onClick={() => c.removeFromGenerate(m.id)} />
                </li>
              ))}
            </ol>
          </>
        )}

        {genReport ? (
          <div className="gen-report">
            {found ? (
              <>
                <Note tone="ok">{`${genReport.added} pronostic${genReport.added > 1 ? "s ajoutés" : " ajouté"} à « Mon coupon ».`}</Note>
                <ChipBtn tone="gold" icon={ArrowRight} onClick={() => c.setActiveTab("build")}>Voir mon coupon</ChipBtn>
              </>
            ) : null}
            {genReport.problems.map((problem, i) => (
              <Note key={i} tone={found ? "warn" : "bad"}>{problem}</Note>
            ))}
            {genReport.notice ? <Note>{genReport.notice}</Note> : null}
          </div>
        ) : null}

        <div className="gen-submit">
          <Btn icon={Zap} onClick={c.generateAutoCoupon} disabled={empty || genLoading}>{genLoading ? "Génération…" : "Générer mon coupon"}</Btn>
        </div>
        {genLoading ? (
          <div className="progress progress--center" role="status">
            <Spinner />
            <span>Analyse en cours : jusqu'à une minute.</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
