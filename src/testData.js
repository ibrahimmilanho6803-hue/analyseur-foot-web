// Données de test partagées (ce fichier n'est pas inclus dans l'application construite).
// Liste telle que la renvoie GET /api/teams (extrait).
const league = (key, nom) => ({ key, nom, pays: "X", charge: true });
export const CATALOG = {
  complet: true,
  championnats: [league("PL", "Premier League"), league("FL1", "Ligue 1"), league("PD", "Liga"), league("SA", "Serie A"), league("BL1", "Bundesliga")],
  equipes: [
    { nom: "Arsenal", championnat: "PL", noms: ["Arsenal FC", "The Gunners"] },
    { nom: "Manchester City", championnat: "PL", noms: ["Man City", "Manchester City FC", "Citizens"] },
    { nom: "Manchester United", championnat: "PL", noms: ["Man United", "Man Utd", "Red Devils"] },
    { nom: "Tottenham Hotspur", championnat: "PL", noms: ["Spurs", "Tottenham"] },
    { nom: "Paris SG", championnat: "FL1", noms: ["PSG", "Paris Saint-Germain", "Paris Saint Germain"] },
    { nom: "Paris FC", championnat: "FL1", noms: [] },
    { nom: "Marseille", championnat: "FL1", noms: ["Olympique de Marseille", "OM"] },
    { nom: "Barcelona", championnat: "PD", noms: ["FC Barcelona", "Barça", "Barca"] },
    { nom: "Atlético Madrid", championnat: "PD", noms: ["Atletico Madrid", "Atleti"] },
    { nom: "Real Madrid", championnat: "PD", noms: ["Real Madrid CF"] },
    { nom: "Real Sociedad", championnat: "PD", noms: [] },
    { nom: "Real Betis", championnat: "PD", noms: [] },
    { nom: "Inter Milan", championnat: "SA", noms: ["Inter", "FC Internazionale Milano", "Internazionale"] },
    { nom: "AC Milan", championnat: "SA", noms: ["Milan"] },
    { nom: "Bayern Munich", championnat: "BL1", noms: ["FC Bayern München", "Bayern", "FC Bayern"] },
    { nom: "Borussia Dortmund", championnat: "BL1", noms: ["BVB", "Dortmund"] },
  ],
};
