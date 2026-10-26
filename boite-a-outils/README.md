# Compresseur d’images — Boîte à outils

Outil statique compatible GitHub Pages pour convertir plusieurs images à la fois, directement dans le navigateur.

## Fonctionnalités
- Import multiple par sélecteur de fichiers ou glisser-déposer.
- Conversion en JPEG, PNG, WebP et AVIF lorsque l’encodeur natif du navigateur le prend en charge.
- Réglage de qualité pour les formats avec perte.
- Redimensionnement facultatif et conservation des proportions.
- Comparaison du poids d’origine et du résultat, téléchargement individuel et export ZIP.
- Mode clair/sombre partagé avec le site dartist.

## Limites
L’outil vérifie la prise en charge réelle des formats par le navigateur. JPEG XL, QOI, MozJPEG et OxiPNG nécessitent des encodeurs spécialisés qui ne sont pas embarqués ici et sont donc indiqués comme indisponibles plutôt que de promettre une conversion non fonctionnelle. Le script JSZip est chargé depuis jsDelivr uniquement pour créer l’archive ZIP ; les images elles-mêmes ne sont pas téléversées.

## Utilisation
Ouvrir `index.html` dans un navigateur moderne ou accéder à https://dartist-fr.github.io/boite-a-outils/.
