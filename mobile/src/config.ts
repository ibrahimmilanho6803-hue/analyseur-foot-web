// Adresse du serveur. Modifiable au moment de la construction avec la variable EXPO_PUBLIC_API_URL
// (Expo la remplace par sa valeur dans le code : il faut écrire exactement « process.env.EXPO_PUBLIC_API_URL »).
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://analyseur-foot-api.onrender.com").replace(/\/+$/, "");
