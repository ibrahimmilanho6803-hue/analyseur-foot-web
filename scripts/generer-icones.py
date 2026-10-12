#!/usr/bin/env python3
"""Génère les icônes de l'application (site et Android) aux couleurs de l'application.

Motif original : cercle central et ligne médiane d'un terrain (craie) avec un ballon doré au point de coup d'envoi,
sur le vert profond de l'écran principal (couleurs de src/theme.js).

Écrit : le site (public/), le projet Android Capacitor (android/) et l'application React Native (mobile/assets/).

Usage (depuis la racine du dépôt) :  python3 scripts/generer-icones.py
Dépendance : Pillow (pip install pillow).
"""

import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOND = (11, 31, 22)      # theme.js : bgDeep  #0B1F16
CRAIE = (233, 236, 227)  # theme.js : chalk   #E9ECE3
OR = (212, 167, 44)      # theme.js : gold    #D4A72C
SUR = 8                  # sur-échantillonnage (lissage des bords)


def polygone(cx, cy, rayon, angle0, sommets=5):
    return [
        (cx + rayon * math.cos(math.radians(angle0 + 360.0 * k / sommets)),
         cy + rayon * math.sin(math.radians(angle0 + 360.0 * k / sommets)))
        for k in range(sommets)
    ]


def motif(n, echelle=1.0, detail=2, mono=False):
    """Calque RGBA n×n transparent, motif centré. `echelle` < 1 le rétrécit ; `detail` : 0 simple, 1 pentagone, 2 complet.
    `mono` : silhouette blanche (icône monochrome d'Android 13+) ; les parties sombres deviennent transparentes."""
    craie, or_, sombre_c = ((255, 255, 255),) * 2 + ((0, 0, 0, 0),) if mono else (CRAIE, OR, FOND + (255,))
    N = n * SUR
    calque = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    c = N / 2.0
    u = N * echelle
    petit = detail == 0
    trait = (0.066 if petit else 0.030) * u

    # Cercle central (trait centré sur le rayon).
    r = 0.30 * u
    d.ellipse([c - r - trait / 2, c - r - trait / 2, c + r + trait / 2, c + r + trait / 2], fill=craie + (255,))
    d.ellipse([c - r + trait / 2, c - r + trait / 2, c + r - trait / 2, c + r - trait / 2], fill=(0, 0, 0, 0))
    # Ligne médiane, bouts arrondis.
    demi = 0.38 * u
    d.rectangle([c - demi, c - trait / 2, c + demi, c + trait / 2], fill=craie + (255,))
    for x in (c - demi, c + demi):
        d.ellipse([x - trait / 2, c - trait / 2, x + trait / 2, c + trait / 2], fill=craie + (255,))

    # Ballon : léger liseré de la couleur du fond pour le détacher des lignes, puis disque doré.
    rb = (0.20 if petit else 0.15) * u
    halo = rb + (0.024 if petit else 0.020) * u
    d.ellipse([c - halo, c - halo, c + halo, c + halo], fill=sombre_c)
    ballon = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    b = ImageDraw.Draw(ballon)
    b.ellipse([c - rb, c - rb, c + rb, c + rb], fill=or_ + (255,))
    if detail >= 1:
        sombre = sombre_c
        pent = (0.34 if detail == 2 else 0.42) * rb
        b.polygon(polygone(c, c, pent, -90), fill=sombre)
        if detail >= 2:
            for k in range(5):
                ang = -90 + 72 * k
                cos, sin = math.cos(math.radians(ang)), math.sin(math.radians(ang))
                # Couture du sommet du pentagone central jusqu'au pentagone du bord.
                b.line([(c + pent * cos, c + pent * sin), (c + 0.80 * rb * cos, c + 0.80 * rb * sin)],
                       fill=sombre, width=max(1, round(0.014 * u)))
                # Pentagone du bord (un sommet tourné vers le centre), rogné par le disque du ballon.
                b.polygon(polygone(c + 1.04 * rb * cos, c + 1.04 * rb * sin, 0.34 * rb, ang + 180), fill=sombre)
        # Anneau doré : garde un contour rond net même là où les pentagones du bord touchent le disque.
        anneau = max(1.0, 0.012 * u)
        b.ellipse([c - rb, c - rb, c + rb, c + rb], outline=or_ + (255,), width=max(1, round(anneau)))
    masque = Image.new("L", (N, N), 0)
    ImageDraw.Draw(masque).ellipse([c - rb, c - rb, c + rb, c + rb], fill=255)
    ballon.putalpha(ImageChops.multiply(ballon.getchannel("A"), masque))
    calque.alpha_composite(ballon)
    return calque


def rendre(n, fond="plein", echelle=1.0, detail=2, mono=False):
    """Image n×n. fond : « plein » (carré), « arrondi » (carré aux coins arrondis), « rond », « aucun » (transparent)."""
    N = n * SUR
    image = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    if fond == "plein":
        image.paste(FOND + (255,), [0, 0, N, N])
    elif fond in ("arrondi", "rond"):
        marge = 0.02 * N if fond == "rond" else 0.03 * N
        boite = [marge, marge, N - marge, N - marge]
        d = ImageDraw.Draw(image)
        if fond == "rond":
            d.ellipse(boite, fill=FOND + (255,))
        else:
            d.rounded_rectangle(boite, radius=0.2 * N, fill=FOND + (255,))
    image.alpha_composite(motif(n, echelle, detail, mono))
    return image.resize((n, n), Image.LANCZOS)


def niveau_de_detail(n):
    return 0 if n <= 24 else 1 if n <= 48 else 2


def ecrire(chemin, image, **options):
    chemin = os.path.join(RACINE, chemin)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    image.save(chemin, **options)
    print("écrit", os.path.relpath(chemin, RACINE), image.size)


def splash(largeur, hauteur):
    """Écran de démarrage : fond uni, motif centré (diamètre ≈ 40 % de la plus petite dimension)."""
    n = round(min(largeur, hauteur) * 0.40 / 0.76)  # le motif occupe 0,76 de son carré
    fond = Image.new("RGB", (largeur, hauteur), FOND)
    m = rendre(n, "aucun", 1.0, 2)
    fond.paste(m, ((largeur - n) // 2, (hauteur - n) // 2), m)
    return fond


def main():
    # --- Site ---------------------------------------------------------------
    ecrire("public/logo192.png", rendre(192).convert("RGB"), optimize=True)
    ecrire("public/logo512.png", rendre(512).convert("RGB"), optimize=True)
    tailles = [16, 24, 32, 48, 64]
    images = [rendre(t, "arrondi", 1.0, niveau_de_detail(t)) for t in tailles]
    ecrire("public/favicon.ico", images[-1], format="ICO", sizes=[(t, t) for t in tailles], append_images=images[:-1])

    # --- Application React Native (Expo) -------------------------------------
    zone_sure = 33 / 108 / 0.38 * 0.98  # même zone sûre que l'icône adaptative Android ci-dessus
    ecrire("mobile/assets/icon.png", rendre(1024).convert("RGB"), optimize=True)
    ecrire("mobile/assets/android-icon-foreground.png", rendre(1024, "aucun", zone_sure), optimize=True)
    ecrire("mobile/assets/android-icon-monochrome.png", rendre(1024, "aucun", zone_sure, 2, True), optimize=True)
    ecrire("mobile/assets/splash-icon.png", rendre(1024, "aucun"), optimize=True)
    ecrire("mobile/assets/favicon.png", rendre(48, "arrondi", 1.0, niveau_de_detail(48)), optimize=True)

    # --- Android : icône (adaptative, dès Android 8) -------------------------
    # Premier plan 108 dp ; la zone toujours visible est un disque de 66 dp : le motif (rayon 0,38 × échelle) y tient.
    densites = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for nom, k in densites.items():
        res = f"android/app/src/main/res/mipmap-{nom}"
        ecrire(f"{res}/ic_launcher_foreground.png", rendre(round(108 * k), "aucun", 33 / 108 / 0.38 * 0.98))
        ecrire(f"{res}/ic_launcher.png", rendre(round(48 * k), "arrondi", 1.0, niveau_de_detail(round(48 * k))))
        ecrire(f"{res}/ic_launcher_round.png", rendre(round(48 * k), "rond", 0.92, niveau_de_detail(round(48 * k))))
    fond_xml = os.path.join(RACINE, "android/app/src/main/res/values/ic_launcher_background.xml")
    with open(fond_xml, "w", encoding="utf-8", newline="") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>' % FOND)
    print("écrit", os.path.relpath(fond_xml, RACINE))

    # --- Android : écran de démarrage (mêmes dimensions que les fichiers existants) -------------
    tailles_splash = {
        "drawable": (480, 320),
        "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480), "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960), "drawable-land-xxxhdpi": (1920, 1280),
        "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800), "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600), "drawable-port-xxxhdpi": (1280, 1920),
    }
    for dossier, (l, h) in tailles_splash.items():
        ecrire(f"android/app/src/main/res/{dossier}/splash.png", splash(l, h), optimize=True)


if __name__ == "__main__":
    sys.exit(main())
