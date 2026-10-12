#!/usr/bin/env python3
"""Essai de l'APK dans un émulateur Android : on fait ce que ferait quelqu'un qui prend le téléphone.

Lancé par le workflow « APK Android » quand l'émulateur est démarré (adb le voit).
Usage : essai_emulateur.py APK [DOSSIER_DES_CAPTURES]
Code de sortie : 0 si tout est bon, 1 sinon.

Étapes :
  1. l'APK s'installe ;
  2. l'application s'ouvre et affiche son titre (polices et code JavaScript chargés) ;
  3. les quatre onglets s'ouvrent, rien ne dépasse de l'écran ;
  4. le bouton « retour » d'Android ramène de l'Historique à « Mon coupon » ;
  5. on saisit un match, on l'enregistre, on ferme l'application, on la rouvre : le coupon est toujours dans l'Historique ;
  6. on tape un nom de club : le serveur propose des suggestions (simple avertissement si le serveur ne répond pas) ;
  7. le journal du téléphone ne contient aucune erreur fatale ni erreur JavaScript.
"""
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PKG = "com.analyseur.footpro"
FIN = time.time() + 15 * 60  # temps maximum pour tout l'essai
BORNES = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")
ADB = shutil.which("adb") or os.path.join(os.environ.get("ANDROID_HOME", ""), "platform-tools", "adb")
CAPTURES = None
LARGEUR = 0
HAUTEUR = 0
RESULTATS = []  # (réussi, étape, détail)
N_CAPTURE = 0
JOURNAL = []  # lignes utiles du journal du téléphone (logcat), recueillies avant chaque effacement
JOURNAL_UTILE = re.compile(r"com\.analyseur\.footpro|ReactNative|AndroidRuntime|SoLoader|DEBUG|libc|Hermes|[Ee]xpo|ANR in|Fatal signal|FATAL")


# ---------------------------------------------------------------------------------------------------------------- compte rendu
def echappe(texte):
    return str(texte).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def annotation(niveau, titre, message):
    print(f"::{niveau} title={echappe(titre)}::{echappe(message)}", flush=True)


def reussi(etape, detail=""):
    RESULTATS.append((True, etape, detail))
    print(f"  ✔ {etape} {detail}".rstrip(), flush=True)


def echoue(etape, detail=""):
    RESULTATS.append((False, etape, detail))
    print(f"  ✘ {etape} {detail}".rstrip(), flush=True)
    annotation("error", f"Essai émulateur : {etape}", detail or "échec")


def avertit(etape, detail=""):
    RESULTATS.append((True, etape + " (avertissement)", detail))
    print(f"  ! {etape} {detail}".rstrip(), flush=True)
    annotation("warning", f"Essai émulateur : {etape}", detail)


# ---------------------------------------------------------------------------------------------------------------- adb
def adb(*args, delai=60, binaire=False):
    try:
        r = subprocess.run([ADB, *args], capture_output=True, timeout=delai)
    except subprocess.TimeoutExpired:
        return 124, (b"" if binaire else ""), "délai dépassé"
    sortie = r.stdout if binaire else r.stdout.decode("utf-8", "replace")
    return r.returncode, sortie, r.stderr.decode("utf-8", "replace")


def prop(nom):
    return adb("shell", "getprop", nom)[1].strip()


class Noeud:
    """Un élément de l'écran tel que le voit l'accessibilité d'Android (ce que lit TalkBack)."""

    def __init__(self, e):
        self.texte = e.get("text", "")
        self.desc = e.get("content-desc", "")
        self.classe = e.get("class", "")
        self.paquet = e.get("package", "")
        self.clic = e.get("clickable") == "true"
        m = BORNES.match(e.get("bounds", ""))
        self.x1, self.y1, self.x2, self.y2 = (int(v) for v in m.groups()) if m else (0, 0, 0, 0)

    @property
    def cx(self):
        return (self.x1 + self.x2) // 2

    @property
    def cy(self):
        return (self.y1 + self.y2) // 2

    def __repr__(self):
        return f"<{self.classe.split('.')[-1]} texte={self.texte!r} desc={self.desc!r} [{self.x1},{self.y1}][{self.x2},{self.y2}]>"


def ecran(garde=None):
    """Lit l'écran (liste de Noeud) ; None si le téléphone n'est pas prêt. 'garde' : nom du fichier où conserver le XML."""
    code, _, _ = adb("shell", "uiautomator", "dump", "/sdcard/ecran.xml", delai=90)
    if code != 0:
        return None
    code, brut, _ = adb("exec-out", "cat", "/sdcard/ecran.xml", binaire=True)
    if code != 0 or not brut:
        return None
    if garde and CAPTURES:
        with open(os.path.join(CAPTURES, garde), "wb") as f:
            f.write(brut)
    try:
        racine = ET.fromstring(brut)
    except ET.ParseError:
        return None
    return [Noeud(e) for e in racine.iter("node")]


def trouve(noeuds, motif, champ="les deux"):
    """Éléments DE L'APPLICATION dont le texte (ou la description) correspond en entier à l'expression régulière 'motif'."""
    rx = re.compile(motif, re.S | re.I)  # sans tenir compte de la casse : les titres sont affichés en majuscules
    res = []
    for n in noeuds or []:
        if n.paquet != PKG:  # pas le lanceur d'applications ni une fenêtre du système
            continue
        valeurs = {"texte": [n.texte], "desc": [n.desc], "les deux": [n.texte, n.desc]}[champ]
        if any(v and rx.fullmatch(v) for v in valeurs):
            res.append(n)
    return res


def attend(chercher, delai, pause=1.5):
    """Relit l'écran jusqu'à ce que 'chercher(noeuds)' renvoie quelque chose de vrai. Renvoie (résultat, dernier écran)."""
    fin = min(time.time() + delai, FIN)
    dernier = None
    while True:
        noeuds = ecran()
        if noeuds is not None:
            dernier = noeuds
            r = chercher(noeuds)
            if r:
                return r, noeuds
        if time.time() >= fin:
            return None, dernier
        time.sleep(pause)


def touche(n):
    adb("shell", "input", "tap", str(n.cx), str(n.cy))


def saisit(texte):
    adb("shell", "input", "text", texte.replace(" ", "%s"))


def defile_vers_le_bas():
    x = LARGEUR // 2
    adb("shell", "input", "swipe", str(x), str(int(HAUTEUR * 0.72)), str(x), str(int(HAUTEUR * 0.35)), "350")
    time.sleep(0.6)


def capture(nom):
    global N_CAPTURE
    if not CAPTURES:
        return
    N_CAPTURE += 1
    base = f"{N_CAPTURE:02d}-{nom}"
    code, png, _ = adb("exec-out", "screencap", "-p", binaire=True, delai=60)
    if code == 0 and png.startswith(b"\x89PNG"):
        with open(os.path.join(CAPTURES, base + ".png"), "wb") as f:
            f.write(png)
    ecran(garde=base + ".xml")


def vu(noeuds, n=14):
    """Quelques textes visibles à l'écran, pour comprendre un échec."""
    if not noeuds:
        return "écran illisible"
    de_l_app = [x for x in noeuds if x.paquet == PKG]
    if not de_l_app:
        paquets = sorted({x.paquet for x in noeuds})
        return f"aucun élément de l'application ; fenêtres : {paquets}"
    textes = []
    for x in de_l_app:
        t = x.texte or x.desc
        if t and t not in textes:
            textes.append(t if len(t) < 60 else t[:57] + "…")
    return str(textes[:n])


def sortie_d_ecran(noeuds):
    """Éléments avec du texte qui dépassent du côté de l'écran (défaut de mise en page)."""
    return [n for n in noeuds if n.paquet == PKG and (n.texte or n.desc) and (n.x2 > LARGEUR + 2 or n.x1 < -2) and n.x2 > n.x1]


# ---------------------------------------------------------------------------------------------------------------- étapes
def collecte_journal():
    """Garde les lignes utiles du journal du téléphone puis l'efface (le prochain démarrage repart d'un journal vide)."""
    _, brut, _ = adb("logcat", "-d", "-v", "threadtime", delai=120)
    JOURNAL.extend(l for l in brut.splitlines() if JOURNAL_UTILE.search(l))
    adb("logcat", "-c")


def plante():
    """Début de l'erreur fatale si l'application a planté depuis l'effacement du journal, sinon chaîne vide."""
    _, brut, _ = adb("logcat", "-d", "-b", "crash", "-v", "brief", delai=60)
    lignes = brut.splitlines()
    for i, l in enumerate(lignes):
        if "FATAL EXCEPTION" in l or "Fatal signal" in l:
            return " | ".join(x.split(": ", 1)[-1].strip() for x in lignes[i : i + 4])[:500]
    return ""


def reseau(actif):
    """Mode avion du téléphone virtuel : coupe ou rétablit le réseau (pour ne pas faire de vraies analyses pendant l'essai)."""
    adb("shell", "cmd", "connectivity", "airplane-mode", "enable" if actif is False else "disable")
    time.sleep(4)
    mode_avion = adb("shell", "settings", "get", "global", "airplane_mode_on")[1].strip()
    if actif:
        # le Wi-Fi virtuel se reconnecte tout seul ; on attend que le téléphone juge la connexion valide
        fin = time.time() + 45
        while time.time() < fin:
            if "VALIDATED" in adb("shell", "dumpsys", "connectivity", delai=60)[1]:
                return True
            time.sleep(3)
        return False
    return mode_avion == "1"


def verifie_delai():
    if time.time() > FIN:
        echoue("Durée", "l'essai a dépassé 15 minutes")
        return False
    return True


def infos_telephone():
    global LARGEUR, HAUTEUR
    taille = adb("shell", "wm", "size")[1]
    m = re.findall(r"(\d+)x(\d+)", taille)
    if m:
        LARGEUR, HAUTEUR = (int(v) for v in m[-1])
    densite = re.findall(r"(\d+)", adb("shell", "wm", "density")[1])
    dpi = int(densite[-1]) if densite else 0
    largeur_dp = round(LARGEUR * 160 / dpi) if dpi else 0
    detail = f"Android {prop('ro.build.version.release')} (API {prop('ro.build.version.sdk')}), écran {LARGEUR}×{HAUTEUR} px ({largeur_dp} dp de large), processeurs : {prop('ro.product.cpu.abilist')}"
    print(f"Téléphone virtuel : {detail}", flush=True)
    annotation("notice", "Essai émulateur : téléphone virtuel", detail)
    # Pas de fenêtre « l'application ne répond pas » qui masquerait l'écran pendant l'essai.
    adb("shell", "settings", "put", "global", "hide_error_dialogs", "1")


def installe(apk):
    code, sortie, erreur = adb("install", "-r", apk, delai=300)
    if code == 0 and "Success" in sortie:
        reussi("Installation de l'APK", "réussie")
        return True
    echoue("Installation de l'APK", (sortie + erreur).strip()[:400])
    return False


def lance():
    """Ouvre l'application comme le ferait un appui sur son icône. Renvoie (écran, durée) ou None si elle ne s'ouvre pas."""
    adb("shell", "am", "force-stop", PKG)
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    collecte_journal()
    debut = time.time()
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    fin = min(time.time() + 150, FIN)
    noeuds = None
    while time.time() < fin:
        noeuds = ecran()
        if noeuds and trouve(noeuds, r"Analyseur Foot Pro", "texte"):
            return noeuds, time.time() - debut
        erreur = plante()
        if erreur:
            capture("demarrage-plante")
            echoue("Démarrage de l'application", f"l'application plante : {erreur}")
            return None
        time.sleep(2)
    capture("demarrage-echec")
    echoue("Démarrage de l'application", f"le titre n'apparaît pas après 150 s ; à l'écran : {vu(noeuds)}")
    return None


def onglet(noeuds, nom):
    """Le bouton de la barre d'onglets du bas (le plus bas des éléments portant ce nom)."""
    candidats = trouve(noeuds, re.escape(nom) + r"(, .*)?", "desc")
    return max(candidats, key=lambda n: n.y1) if candidats else None


ONGLETS = [
    ("Top Matchs", r"Top 3 Matchs à venir", "top"),
    ("Auto", r"Génération automatique", "auto"),
    ("Historique", r"Aucun coupon", "historique"),
    ("Mon coupon", r"Ajouter un match", "coupon"),
]


def ouvre_onglet(nom, attendu):
    """Appuie sur l'onglet 'nom' et attend son contenu (texte 'attendu'). Renvoie l'écran obtenu ou None."""
    trouve_barre, noeuds = attend(lambda ns: onglet(ns, nom), 20)
    if trouve_barre is None and noeuds is not None:
        # la barre est cachée : le clavier est ouvert, le bouton retour le referme
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(1.5)
        trouve_barre, noeuds = attend(lambda ns: onglet(ns, nom), 10)
    if trouve_barre is None:
        print(f"    onglet « {nom} » introuvable ; à l'écran : {vu(noeuds)}", flush=True)
        return None
    touche(trouve_barre)
    trouve_contenu, noeuds = attend(lambda ns: trouve(ns, attendu, "texte"), 25)
    if not trouve_contenu:
        print(f"    contenu « {attendu} » introuvable ; à l'écran : {vu(noeuds)}", flush=True)
    return noeuds if trouve_contenu else None


def verifie_onglets():
    for nom, attendu, court in ONGLETS:
        if not verifie_delai():
            return
        hors_ligne = court == "top"
        if hors_ligne:
            # L'onglet « Top Matchs » interroge le serveur dès qu'on l'ouvre (analyse de tous les championnats, avec l'IA) :
            # pendant l'essai on le fait hors ligne, pour voir le message d'erreur sans consommer les appels du serveur.
            if not reseau(False):
                avertit("Onglet « Top Matchs »", "le mode avion n'a pas pu être activé : onglet non essayé (pour ne pas lancer une vraie analyse)")
                continue
        noeuds = ouvre_onglet(nom, attendu)
        detail = "affiché"
        if noeuds is not None and hors_ligne:
            erreur, plus_recent = attend(lambda ns: trouve(ns, r"Impossible de charger les matchs.*", "texte"), 20)
            noeuds = plus_recent or noeuds
            detail = f"affiché hors ligne avec son message d'erreur « {erreur[0].texte[:80]} »" if erreur else f"affiché mais sans message d'erreur hors ligne ; à l'écran : {vu(noeuds)}"
        if noeuds is None:
            capture(f"onglet-{court}-echec")
            echoue(f"Onglet « {nom} »", f"le contenu « {attendu} » n'apparaît pas")
        else:
            capture(f"onglet-{court}")
            debord = sortie_d_ecran(noeuds)
            if debord:
                avertit(f"Onglet « {nom} »", f"{detail} ; {len(debord)} élément(s) dépassent de l'écran ({LARGEUR} px) : {debord[:3]}")
            else:
                reussi(f"Onglet « {nom} »", f"{detail}, rien ne dépasse de l'écran")
        if hors_ligne and not reseau(True):
            avertit("Réseau", "connexion non rétablie après 45 s ; les essais suivants qui en dépendent peuvent échouer")


def verifie_retour():
    if ouvre_onglet("Historique", r"Aucun coupon") is None:
        echoue("Bouton retour", "impossible d'ouvrir l'Historique")
        return
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    ok, _ = attend(lambda ns: trouve(ns, r"Ajouter un match", "texte"), 15)
    if ok:
        reussi("Bouton retour", "de l'Historique, ramène à « Mon coupon »")
    else:
        capture("retour-echec")
        echoue("Bouton retour", "« Mon coupon » n'est pas revenu à l'écran")
        lance()


def champ(noeuds, nom):
    r = trouve(noeuds, re.escape(nom), "desc")
    return r[0] if r else None


def va_a(motif, champ="les deux", essais=10):
    """Fait défiler la page vers le bas jusqu'à voir un élément correspondant à 'motif' ; le renvoie, ou None."""
    for _ in range(essais):
        noeuds = ecran()
        if noeuds:
            n = trouve(noeuds, motif, champ)
            if n:
                return n[0]
        defile_vers_le_bas()
    return None


def ferme_le_clavier_si_besoin():
    noeuds = ecran()
    if noeuds is not None and onglet(noeuds, "Mon coupon") is None:  # la barre d'onglets se cache quand le clavier est ouvert
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(1.5)


def verifie_enregistrement():
    equipe1, equipe2 = "Alpha FC", "Beta FC"
    if ouvre_onglet("Mon coupon", r"Ajouter un match") is None:
        echoue("Enregistrement d'un coupon", "impossible d'ouvrir « Mon coupon »")
        return
    noeuds = ecran()
    f1 = champ(noeuds, "Équipe 1 (à domicile)")
    if f1 is None:
        echoue("Enregistrement d'un coupon", "champ « Équipe 1 » introuvable")
        return
    touche(f1)
    time.sleep(1.5)
    saisit(equipe1)
    time.sleep(1)
    capture("saisie-equipe1")
    noeuds = ecran()
    f2 = champ(noeuds, "Équipe 2 (à l'extérieur)") if noeuds else None
    if f2 is None:
        echoue("Enregistrement d'un coupon", "champ « Équipe 2 » introuvable")
        return
    touche(f2)
    time.sleep(1.5)
    saisit(equipe2)
    time.sleep(1)
    ferme_le_clavier_si_besoin()
    ajouter = va_a("Ajouter", "desc")
    if ajouter is None:
        capture("ajouter-introuvable")
        echoue("Enregistrement d'un coupon", "bouton « Ajouter » introuvable")
        return
    touche(ajouter)
    bouton = va_a("Enregistrer", "desc")
    if bouton is None:
        capture("ajout-echec")
        echoue("Enregistrement d'un coupon", f"le match n'a pas été ajouté (pas de bouton « Enregistrer ») ; à l'écran : {vu(ecran())}")
        return
    capture("coupon-un-match")
    if bouton is None:
        echoue("Enregistrement d'un coupon", "bouton « Enregistrer » introuvable")
        return
    touche(bouton)
    time.sleep(2)
    historique = ouvre_onglet("Historique", rf"{equipe1} vs {equipe2}.*")
    if historique is None:
        capture("historique-echec")
        echoue("Enregistrement d'un coupon", "le coupon enregistré n'apparaît pas dans l'Historique")
        return
    capture("historique-avec-coupon")
    reussi("Enregistrement d'un coupon", f"« {equipe1} vs {equipe2} » est dans l'Historique")

    # Fermeture complète puis réouverture : les données doivent être sur le téléphone, pas seulement en mémoire.
    time.sleep(2)
    redemarre = lance()
    if redemarre is None:
        return
    historique = ouvre_onglet("Historique", rf"{equipe1} vs {equipe2}.*")
    if historique is None:
        capture("persistance-echec")
        echoue("Coupon conservé après redémarrage", "le coupon a disparu de l'Historique")
    else:
        capture("historique-apres-redemarrage")
        reussi("Coupon conservé après redémarrage", "toujours dans l'Historique")


def verifie_suggestions():
    if ouvre_onglet("Mon coupon", r"Ajouter un match") is None:
        avertit("Suggestions de clubs", "impossible d'ouvrir « Mon coupon »")
        return
    noeuds = ecran()
    f1 = champ(noeuds, "Équipe 1 (à domicile)")
    if f1 is None:
        avertit("Suggestions de clubs", "champ « Équipe 1 » introuvable")
        return
    touche(f1)
    time.sleep(1.5)
    saisit("Arse")
    debut = time.time()
    options, noeuds = attend(lambda ns: trouve(ns, r"(?i)arsenal.*", "desc"), 120)
    if not options:
        capture("suggestions-absentes")
        avertit("Suggestions de clubs", "aucune suggestion « Arsenal » après 120 s : serveur injoignable depuis l'émulateur, ou liste de clubs vide")
        return
    capture("suggestions")
    touche(options[0])
    choisi, _ = attend(lambda ns: [n for n in ns if n.classe.endswith("EditText") and n.texte.lower().startswith("arsenal")], 10)
    if choisi:
        reussi("Suggestions de clubs", f"« Arse » → « {choisi[0].texte} » ({time.time() - debut:.0f} s)")
    else:
        avertit("Suggestions de clubs", "la suggestion s'affiche mais son choix ne remplit pas le champ")


def verifie_journal(dossier):
    collecte_journal()
    if dossier:
        with open(os.path.join(dossier, "logcat.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(JOURNAL) + "\n")
    fatales = [l for l in JOURNAL if re.search(r"FATAL EXCEPTION|Fatal signal \d+|ANR in com\.analyseur\.footpro", l)]
    js = [l for l in JOURNAL if re.search(r" E ReactNativeJS", l)]
    polices = [l for l in JOURNAL if "Polices non chargées" in l]
    avertissements_js = [l for l in JOURNAL if re.search(r" W ReactNativeJS", l)]
    if fatales:
        echoue("Journal du téléphone", f"{len(fatales)} erreur(s) fatale(s) : {fatales[0][-300:]}")
    elif js:
        echoue("Journal du téléphone", f"{len(js)} erreur(s) JavaScript : {js[0][-300:]}")
    elif polices:
        echoue("Journal du téléphone", f"polices non chargées : {polices[0][-300:]}")
    else:
        reussi("Journal du téléphone", f"aucune erreur fatale ni JavaScript ({len(JOURNAL)} lignes utiles lues)")
    if avertissements_js:
        avertit("Avertissements JavaScript", f"{len(avertissements_js)} : {avertissements_js[0][-250:]}")


def conclusion():
    echecs = [r for r in RESULTATS if not r[0]]
    resume = os.environ.get("GITHUB_STEP_SUMMARY")
    if resume:
        with open(resume, "a", encoding="utf-8") as f:
            f.write("### Essai de l'APK dans un téléphone virtuel Android\n\n| | Étape | Détail |\n|---|---|---|\n")
            for ok, etape, detail in RESULTATS:
                f.write(f"| {'✅' if ok else '❌'} | {etape} | {detail.replace('|', '/').replace(chr(10), ' ')[:300]} |\n")
    bilan = " · ".join(("✔ " if ok else "✘ ") + etape for ok, etape, _ in RESULTATS)
    annotation("error" if echecs else "notice", "Essai émulateur : bilan", bilan)
    return 1 if echecs else 0


def main():
    global CAPTURES
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    apk = sys.argv[1]
    if len(sys.argv) > 2:
        CAPTURES = sys.argv[2]
        os.makedirs(CAPTURES, exist_ok=True)
    infos_telephone()
    if not installe(apk):
        return conclusion()
    depart = lance()
    if depart is None:
        verifie_journal(CAPTURES)
        return conclusion()
    noeuds, duree = depart
    reussi("Démarrage de l'application", f"titre affiché après {duree:.0f} s")
    capture("demarrage")
    manquants = [nom for nom, _, _ in ONGLETS if onglet(noeuds, nom) is None]
    if manquants:
        echoue("Barre d'onglets", f"onglets absents : {manquants}")
    verifie_onglets()
    if verifie_delai():
        verifie_retour()
    if verifie_delai():
        verifie_enregistrement()
    if verifie_delai():
        verifie_suggestions()
    verifie_journal(CAPTURES)
    return conclusion()


if __name__ == "__main__":
    sys.exit(main())
