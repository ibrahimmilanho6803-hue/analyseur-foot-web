# Analyseur Foot Pro — site

Application React qui affiche les pronostics calculés par le serveur
[analyseur-foot-backend](https://github.com/ibrahimmilanho6803-hue/analyseur-foot-backend). Elle existe en deux versions : ce site
(dossier `src/`) et une **vraie application Android en React Native** (dossier [`mobile/`](#application-mobile-react-native)).

- **Top Matchs** : les 3 meilleurs matchs à venir, avec la cote combinée *estimée*.
- **Mon coupon** : saisie de sélections, analyse par le serveur (modèle statistique relu par l'IA), probabilité de chaque sélection et du coupon.
- **Auto** : le serveur choisit le pari le plus probable de chaque match saisi.
- **N'importe quel match** : Mon coupon et Auto acceptent deux clubs du même championnat, de championnats différents (Ligue des
  champions, Ligue Europa, Ligue Conférence…) ou un club que seules les coupes d'Europe font connaître ([voir plus bas](#matchs-entre-championnats-ligue-des-champions)).
- **Historique** : coupons enregistrés sur l'appareil (stockage local du navigateur).

Le site ne contient aucune clé secrète et n'appelle jamais l'IA directement : tout passe par le serveur. Si une analyse est
impossible (équipe inconnue, serveur indisponible…), le site affiche « ? » et la raison, il n'invente jamais de probabilité.

## Saisie des clubs : suggestions

Pendant la saisie d'un club (Mon coupon, Auto), le site propose les clubs que le serveur connaît, avec leur championnat. La
comparaison ignore les accents, les majuscules et la ponctuation, reconnaît les écritures alternatives fournies par la source de
données (« Man City », « Man Utd »…), les débuts de mots (« man c » → Manchester City) et tolère une faute de frappe quand rien
d'autre ne correspond. Clavier : ↓ ↑ pour parcourir, Entrée pour choisir, Échap pour fermer. Quand rien ne correspond, un message le
dit, mais la saisie libre reste possible : le serveur est seul juge de la reconnaissance du nom.

- La liste vient de `GET /api/teams` (serveur à jour requis) : les clubs de tous les championnats suivis par le serveur (une trentaine,
  de la Premier League aux championnats complémentaires) et, sous « Autres clubs européens », ceux que seules les coupes d'Europe
  font connaître. Elle est gardée sur l'appareil (clé `coupon-clubs`) : 24 h quand elle est complète, 1 minute seulement tant que des
  championnats sont encore en chargement sur le serveur ou que le serveur n'a pas répondu.
- Cette liste porte un **numéro de version** (`v: 2`) : une liste enregistrée par une version plus ancienne, qui ne connaissait que les
  dix championnats principaux, est ignorée et redemandée au serveur, pour ne pas faire croire pendant un jour qu'un club n'est pas suivi.
- Sans liste (serveur plus ancien, hors ligne, stockage bloqué), les champs restent de simples champs texte et aucune erreur n'est
  affichée : le site fonctionne comme avant.

## Matchs entre championnats (Ligue des champions…)

Le serveur analyse maintenant **n'importe quel match** : deux clubs du même championnat (comme avant), deux clubs de championnats
différents (Ligue des champions, Ligue Europa, Ligue Conférence) ou un club que le serveur ne connaît que par les coupes d'Europe.
Pour deux clubs de championnats différents, le niveau relatif des deux championnats est estimé d'après les matchs de coupes
d'Europe : le résultat est **moins précis** qu'entre deux clubs d'un même championnat, et l'application le dit :

- sous chaque pari concerné (Mon coupon, résultat d'Auto, carte du Top Matchs), un avertissement doré reprend le texte du serveur
  (`comparaisonEntreChampionnats.message`), qui précise la raison — niveau des championnats mesuré par des matchs de coupe, estimation
  générale seulement, ou club d'un championnat non suivi ;
- sous le total du coupon, une mise en garde indique combien de sélections sont concernées : le pourcentage combiné en hérite ;
- le Top Matchs annonce les coupes d'Europe analysées en plus des championnats (`donnees.coupesPretes`).

Avec un serveur plus ancien, ces informations n'existent pas et rien ne s'affiche en plus : le comportement est celui d'avant.

## Analyse en deux temps

« Analyser » envoie d'abord la demande au serveur **sans l'IA** (`POST /api/analyze` avec `ia: false`) : le résultat du modèle
statistique s'affiche en moins d'une seconde, avec un message qui précise que la relecture par l'IA est en cours. Une seconde
demande (les sélections qui attendent encore la relecture) rapporte ensuite le résultat relu par l'IA, quelques secondes plus tard ;
les pourcentages peuvent alors bouger de quelques points (le serveur limite la correction de l'IA à 4 points). Si la relecture
échoue, le résultat du modèle reste affiché et un message l'indique : une probabilité déjà obtenue n'est jamais remplacée par un
échec. Avec un serveur qui ne connaît pas `ia: false`, aucune sélection n'est marquée `ia.statut = "non_demandee"` : le site saute
alors la seconde demande.

Les noms **reconnus par le serveur** sont affichés dans la liste et dans l'historique (« PSG » → « Paris SG »), avec le rappel
« Saisi : … » quand ils s'éloignent de ce qui a été tapé. Deux paris sur le même match sont repérés d'après ces noms.

## Configuration

| Variable (au moment de la construction) | Rôle | Défaut |
|---|---|---|
| `REACT_APP_API_URL` | Adresse du serveur. | `https://analyseur-foot-api.onrender.com` |

## Tests

```
npm test            # tests du site (faux serveur, aucun appel réseau)
CI=true npm run build   # la construction doit passer sans avertissement
```

## Application mobile (React Native)

Le dossier `mobile/` contient l'application **Analyseur Foot Pro** pour Android, écrite en React Native (Expo SDK 57, TypeScript).
Elle fait la même chose que le site — Top Matchs, Mon coupon, Auto, Historique, suggestions de clubs, analyse en deux temps — avec
la même logique et le même serveur, et ne contient aucune clé secrète. Les quatre onglets sont en bas de l'écran, à portée du
pouce ; le bouton « retour » d'Android ramène à « Mon coupon » avant de quitter l'application. L'historique est gardé sur le
téléphone (mêmes clés de stockage que le site : `coupon-pronostics` et `coupon-clubs`).

**Installer l'application sur un téléphone Android**

1. Sur un téléphone Android 7 ou plus récent, ouvrir le lien de téléchargement, qui ne change jamais :
   <https://github.com/ibrahimmilanho6803-hue/analyseur-foot-web/releases/download/apk-latest/analyseur-foot-pro.apk>
2. Ouvrir le fichier téléchargé et autoriser l'installation depuis cette source si Android le demande (réglage « Installer des
   applications inconnues » pour le navigateur utilisé). Android Play Protect peut afficher un avertissement pour une application
   qui ne vient pas du Play Store : choisir « Installer quand même ». Sur certains Samsung (One UI 6.1 et plus), le « Bloqueur
   automatique » (Réglages ▸ Sécurité et confidentialité) refuse toute installation hors Play Store : le désactiver le temps de
   l'installation.
3. Pour **partager** l'application : envoyer le même lien (ou le fichier `.apk`) à n'importe qui. Pour **mettre à jour**, il suffit
   de réinstaller le nouvel APK par-dessus : l'historique enregistré est conservé.

L'application s'installe à côté de l'ancienne version Capacitor (identifiant `com.analyseur.footpro` contre `com.analyseur.foot`) ;
l'ancienne ne sait plus analyser (voir plus bas) et peut être désinstallée.

**iPhone** : l'application native n'est pas fournie (il faut un compte Apple Developer payant). Le site fonctionne très bien sur
iPhone : ouvrir <https://analyseur-foot-web.vercel.app> dans Safari, puis « Partager » ▸ « Sur l'écran d'accueil ».

**Comment l'APK est construit et vérifié**

Le workflow GitHub Actions [`APK Android`](.github/workflows/apk-android.yml) enchaîne trois étapes :

1. **Tests et APK** : les tests, la génération du projet Android (`npx expo prebuild`, le dossier `mobile/android/` n'est jamais écrit
   à la main ni versionné), la compilation de l'APK (nommé `analyseur-foot-pro.apk`, une vingtaine de Mo) et son contrôle
   (identifiant, numéro de version, permissions, processeurs pris en charge, signature).
2. **Essai sur téléphone virtuel** : l'APK est installé dans un émulateur Android 14 ([script](.github/scripts/essai_emulateur.py)),
   puis utilisé comme sur un téléphone. L'application s'ouvre, les quatre onglets s'affichent, le bouton « retour » ramène à « Mon
   coupon », un coupon est enregistré puis l'application est fermée et rouverte (le coupon est toujours dans l'Historique), un nom de
   club est tapé (le serveur propose des suggestions) et le journal du téléphone ne contient aucune erreur de l'application. Hors
   ligne, l'onglet « Top Matchs » affiche un message lisible. Les captures d'écran sont dans les **Artifacts** de l'exécution.
   Cet essai ne lance aucune analyse : ni appel à l'IA, ni consommation du quota de la source de données.
3. **Publier l'APK** : seulement sur la branche principale (ou à la main : Actions ▸ « APK Android » ▸ Run workflow) et seulement si
   les deux étapes précédentes ont réussi. L'APK remplace celui de la version « apk-latest » (Releases), d'où le lien stable
   ci-dessus. Le `versionCode` prend le numéro de l'exécution : il augmente à chaque construction, ce qui permet de mettre à jour
   par-dessus.

Sur une demande de fusion (*pull request*), seules les étapes 1 et 2 s'exécutent : l'APK est téléchargeable 30 jours dans les
**Artifacts** de l'exécution (onglet Actions) et rien n'est publié.

L'essai tourne sur un émulateur PC (l'APK, conçu pour les processeurs ARM des téléphones, y est exécuté par traduction) : il ne
remplace pas un essai sur un vrai téléphone, en particulier sur les marques qui modifient Android (Samsung, Xiaomi…).

**Signature** : l'APK est signé avec la clé de débogage standard d'Expo (elle est publique). C'est suffisant pour installer et
partager l'APK soi-même, et les mises à jour fonctionnent (même clé à chaque fois), mais **pas pour Google Play**, qui exige un
compte développeur (25 USD, une fois), une clé de publication privée et la validation de la politique sur les jeux d'argent.
Changer de clé plus tard obligerait chacun à désinstaller puis réinstaller l'application (l'historique enregistré serait perdu) :
si l'application est amenée à être largement diffusée, il vaut mieux créer la clé privée (à stocker dans les *Secrets* GitHub, jamais
dans le dépôt, qui est public) **avant** la diffusion.

**Développer**

```
cd mobile
npm ci                 # installe exactement les versions de package-lock.json (Node 22 ou plus)
npm test               # tests : logique et écrans (faux serveur, aucun appel réseau)
npx tsc --noEmit       # vérification des types
npx expo start         # lance l'application sur un téléphone avec Expo Go (QR code), pour essayer une modification
```

| Variable (au moment de la construction) | Rôle | Défaut |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Adresse du serveur. | `https://analyseur-foot-api.onrender.com` |

Organisation : `src/api.ts` (appels au serveur, délais et messages d'erreur), `src/estimates.ts` (probabilités : jamais inventées),
`src/suggest.ts` (suggestions de clubs), `src/hooks/useAnalyseur.ts` (tout l'état et les actions), `src/screens/` (un fichier par
onglet), `src/components/` (champ de club, choix du pari, barre d'onglets), `src/theme.ts` (couleurs et polices, communes avec le
site). Les polices (Oswald, JetBrains Mono, Inter) et les icônes sont embarquées dans l'application : elle n'a besoin d'Internet que
pour interroger le serveur.

**Limites communes au site et à l'application** : le serveur est partagé. Les analyses de tous les utilisateurs comptent dans la
même limite quotidienne d'appels à l'IA et dans le même quota de la source de données ; chaque adresse IP (donc chaque réseau
mobile) a aussi sa propre limite de demandes par minute. Quand une limite est atteinte, l'application affiche le message du serveur.

## Ancienne application Android (Capacitor)

> Remplacée par l'application React Native ci-dessus (`mobile/`). Ce projet est conservé pour mémoire.

Le projet Android (`android/`, Capacitor 8) **embarque une copie du site** : il n'ouvre pas l'adresse Vercel. Une application installée
avant une mise à jour du site garde donc l'ancien code tant qu'elle n'est pas reconstruite. Les anciennes versions appelaient la route
`/api/analyze-simple`, retirée du serveur (elle répond HTTP 410) : elles ne peuvent plus analyser et doivent être reconstruites. Le
serveur accepte déjà les origines de l'application (`capacitor://localhost`, `https://localhost`, `http://localhost`).

Il faut un ordinateur avec Node 22 ou plus (exigé par Capacitor 8), le JDK 21 et Android Studio (version récente : le projet utilise
Gradle 8.14 et le plugin Android 8.13 ; SDK 36). Depuis le dossier du site :

```
npm ci                    # installe exactement les versions de package-lock.json
CI=true npm run build     # construit le site dans build/ (REACT_APP_API_URL=… seulement si le serveur change d'adresse)
npx cap sync android      # copie build/ dans le projet Android et met à jour les modules Capacitor
npx cap open android      # ouvre le projet dans Android Studio
```

1. Avant de construire, augmenter `versionCode` (nombre entier : 1 → 2 → …) et `versionName` (par exemple « 1.1 ») dans
   `android/app/build.gradle`.
2. Dans Android Studio : **Build ▸ Generate Signed App Bundle / APK**, puis installer l'APK sur le téléphone (ou envoyer le bundle
   sur Google Play si l'application y est publiée).
3. Pour **remplacer** l'application déjà installée sans la désinstaller, le nouvel APK doit être signé avec **la même clé** que
   l'ancien et avoir un `versionCode` plus élevé. Désinstaller d'abord peut effacer l'historique enregistré sur le téléphone
   (il est gardé dans le stockage local de l'application).
4. La clé de signature (fichier `.jks` ou `.keystore`, et ses mots de passe) ne doit jamais être ajoutée au dépôt, qui est public :
   `.gitignore` bloque ces fichiers par précaution. Gardez-en une copie en lieu sûr : sans elle, une mise à jour en place est impossible.

À chaque évolution du site qui doit aussi arriver dans l'application, refaire la construction du site et `npx cap sync android`,
augmenter `versionCode`, puis republier l'APK.

## Identité visuelle (icônes)

Nom (« Analyseur Foot Pro », « Analyseur Foot » sur l'écran d'accueil), langue, description et couleurs : `public/index.html` et
`public/manifest.json`. L'icône (cercle central et ballon doré sur le vert de l'écran principal, couleurs de `src/theme.js`) est
dessinée par `scripts/generer-icones.py` (`pip install pillow`, puis `python3 scripts/generer-icones.py` depuis la racine) : il
réécrit `public/favicon.ico`, `public/logo192.png`, `public/logo512.png`, ainsi que l'icône et l'écran de démarrage Android
(`android/app/src/main/res/`). Les fichiers Android gardent les dimensions attendues par Capacitor.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
