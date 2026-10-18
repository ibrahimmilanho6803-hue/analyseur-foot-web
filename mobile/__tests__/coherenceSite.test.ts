// Le site (dossier src/ à la racine du dépôt) et l'application proposent exactement les mêmes pronostics : mêmes familles, mêmes noms, mêmes
// probabilités de repli, mêmes remboursements, mêmes anciens noms. Ce test échoue dès qu'une des deux listes est modifiée sans l'autre, pour
// que l'on ne retrouve jamais un pari sur le site qui n'existe pas dans l'application (ou l'inverse).
// Les deux listes doivent aussi rester celles du serveur (analyseur-foot-backend, src/markets.js) : voir le README.
// Les couleurs de l'identité visuelle (vert et or) sont aussi vérifiées : mêmes valeurs dans src/styles.css du site et dans src/theme.ts.
import * as fs from "fs";
import * as path from "path";
import { BASELINE_RATES, BET_GROUPS, LEGACY_LABELS, REFUND_WHEN, TYPES_PARI, canonicalLabel } from "../src/betTypes";
import { T } from "../src/theme";

// Le site est écrit en JavaScript (hors du projet mobile) : on le charge tel quel.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const site = require("../../src/betTypes.js") as typeof import("../src/betTypes");

describe("le site et l'application proposent les mêmes pronostics", () => {
  test("mêmes familles, dans le même ordre, avec les mêmes paris", () => {
    expect(BET_GROUPS).toEqual(site.BET_GROUPS);
    expect(TYPES_PARI).toEqual(site.TYPES_PARI);
  });

  test("mêmes probabilités de repli", () => {
    expect(BASELINE_RATES).toEqual(site.BASELINE_RATES);
  });

  test("mêmes paris remboursables, avec le même texte", () => {
    expect(REFUND_WHEN).toEqual(site.REFUND_WHEN);
  });

  test("mêmes anciens noms, qui se lisent pareil", () => {
    expect(LEGACY_LABELS).toEqual(site.LEGACY_LABELS);
    for (const label of [...Object.keys(LEGACY_LABELS), ...TYPES_PARI, "Pari inconnu"]) {
      expect(canonicalLabel(label)).toBe(site.canonicalLabel(label));
    }
  });

  test("mêmes couleurs que le site", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../src/styles.css"), "utf8");
    for (const [name, hex] of Object.entries(T)) {
      const variable = "--" + name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
      const found = new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(css);
      expect({ variable, couleur: found ? found[1].toUpperCase() : null }).toEqual({ variable, couleur: hex.toUpperCase() });
    }
  });
});
