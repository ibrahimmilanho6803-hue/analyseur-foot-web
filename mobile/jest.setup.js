// Stockage de l'appareil simulé en mémoire pour les tests (aucun accès réel au téléphone).
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Zones sûres (encoches, barre de navigation) : aucune dans les tests.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
