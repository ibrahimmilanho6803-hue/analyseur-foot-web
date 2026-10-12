// Les attentes des tests (findBy…, waitFor) patientent jusqu'à 10 s au lieu d'1 s : sur une machine lente ou au premier lancement
// (cache de compilation vide), l'application peut mettre plus d'une seconde à s'afficher. Un test qui réussit ne ralentit pas :
// l'attente s'arrête dès que la condition est remplie.
const { configure } = require("@testing-library/react-native");

configure({ asyncUtilTimeout: 10000 });
