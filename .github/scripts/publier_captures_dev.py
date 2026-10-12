#!/usr/bin/env python3
"""(Mise au point, à supprimer) Publie les captures de l'essai dans des « checks » du commit pour pouvoir les consulter.

Usage : publier_captures_dev.py DOSSIER   (variables : SHA, GITHUB_REPOSITORY ; 'gh' avec GH_TOKEN)
Les images sont réduites (JPEG), le tout est mis en archive tar.gz, encodé en base64 et découpé en morceaux de 60 000 caractères.
"""
import base64
import glob
import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile

from PIL import Image

dossier = sys.argv[1]
sha = os.environ["SHA"]
repo = os.environ["GITHUB_REPOSITORY"]

with tempfile.TemporaryDirectory() as tmp:
    for f in glob.glob(os.path.join(dossier, "*")):
        nom = os.path.basename(f)
        if nom.endswith(".png"):
            im = Image.open(f).convert("RGB")
            im = im.resize((im.width // 3, im.height // 3), Image.LANCZOS)
            im.save(os.path.join(tmp, nom[:-4] + ".jpg"), "JPEG", quality=55, optimize=True)
        else:
            with open(f, "rb") as src, open(os.path.join(tmp, nom), "wb") as dst:
                dst.write(src.read())
    archive = os.path.join(tmp, "..", "captures-dev.tar.gz")
    with tarfile.open(archive, "w:gz") as t:
        for f in sorted(glob.glob(os.path.join(tmp, "*"))):
            t.add(f, arcname=os.path.basename(f))
    brut = open(archive, "rb").read()

b64 = base64.b64encode(brut).decode()
morceaux = [b64[i : i + 120000] for i in range(0, len(b64), 120000)] or [""]
print(f"archive : {len(brut)} octets, {len(b64)} caractères, {len(morceaux)} check(s)")
for i, m in enumerate(morceaux, 1):
    corps = {
        "name": f"Captures de l'essai {i}/{len(morceaux)}",
        "head_sha": sha,
        "status": "completed",
        "conclusion": "neutral",
        "output": {"title": "Captures (mise au point)", "summary": m[:60000], "text": m[60000:]},
    }
    subprocess.run(["gh", "api", "-X", "POST", f"repos/{repo}/check-runs", "--input", "-"], input=json.dumps(corps).encode(), check=True, stdout=subprocess.DEVNULL)
