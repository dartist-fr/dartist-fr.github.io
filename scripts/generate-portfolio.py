#!/usr/bin/env python3
"""Construit le manifeste du portfolio à partir de l'arborescence des images."""
import json
import os
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "portfolio" / "images"
OUTPUT = ROOT / "portfolio" / "images-manifest.json"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
SUBJECTS = {
    "voyages": "Voyage · Photographie",
    "france": "France · Photographie",
    "red bull": "Sport · Événementiel",
    "sports": "Sport · Photographie",
    "sport": "Sport · Photographie",
    "evenementiel": "Événementiel · Photographie",
    "sports-mecaniques": "Sport mécanique · Photographie",
}

def label(folder_name):
    return folder_name.replace("-", " ").replace("_", " ").strip().title()

def image_url(path):
    # Encode chaque segment, mais conserve les séparateurs de dossier.
    return "/".join(quote(part) for part in path.relative_to(ROOT / "portfolio").parts)

def build(folder, root_label=None):
    children = []
    photos = sorted(
        (p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS),
        key=lambda p: p.name.casefold()
    )
    for child_dir in sorted((p for p in folder.iterdir() if p.is_dir()), key=lambda p: p.name.casefold()):
        children.append(build(child_dir, root_label or folder.name))
    photo_urls = [image_url(p) for p in photos]
    cover = photo_urls[0] if photo_urls else next((c["cover"] for c in children if c.get("cover")), "")
    top_name = root_label or folder.name
    subject = SUBJECTS.get(top_name.casefold(), "Photographie")
    item = {
        "titre": label(folder.name),
        "sujet": subject,
        "cover": cover,
        "photos": photo_urls,
    }
    if children:
        item["children"] = children
    return item

def main():
    if not IMAGE_ROOT.exists():
        raise SystemExit(f"Dossier introuvable : {IMAGE_ROOT}")
    series = []
    for folder in sorted((p for p in IMAGE_ROOT.iterdir() if p.is_dir()), key=lambda p: p.name.casefold()):
        series.append(build(folder, folder.name))
    OUTPUT.write_text(json.dumps(series, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    photo_count = sum(count_photos(s) for s in series)
    print(f"Manifeste généré : {len(series)} séries principales, {photo_count} photos.")

def count_photos(item):
    return len(item.get("photos", [])) + sum(count_photos(c) for c in item.get("children", []))

if __name__ == "__main__":
    main()
