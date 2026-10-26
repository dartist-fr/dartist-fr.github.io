# Portfolio : séries automatiques

Les séries et sous-séries du portfolio sont désormais générées depuis les dossiers présents dans `portfolio/images/`.

## Ajouter une série ou des photos
1. Ouvrir `portfolio/images/` dans GitHub.
2. Créer un dossier (GitHub ne conserve pas les dossiers vides : ajoutez une photo ou un fichier `.gitkeep`).
3. Ajouter les photos dans le dossier. Les formats courants acceptés sont JPG/JPEG, PNG, WebP, AVIF et GIF.
4. Valider le commit sur `main`. La GitHub Action **Actualiser le portfolio** crée ou met à jour `portfolio/images-manifest.json`.
5. Après le déploiement GitHub Pages, la nouvelle série et ses photos apparaissent automatiquement.

Les sous-dossiers sont interprétés comme des sous-séries, sans limite de profondeur pratique. La première image par ordre alphabétique sert de couverture ; si un dossier ne contient pas d'image, la couverture de sa première sous-série avec photo est utilisée.

## Actualisation manuelle
Dans l'onglet **Actions** du dépôt, exécuter **Actualiser le portfolio** puis **Run workflow**.

## Fichiers concernés
- `scripts/generate-portfolio.py` : parcourt les dossiers et génère les données JSON.
- `.github/workflows/portfolio-auto.yml` : lance le générateur lors des changements dans les dossiers d'images.
- `portfolio/images-manifest.json` : données consommées par la page du portfolio.

Les noms des dossiers sont affichés comme titres, avec les tirets et underscores remplacés par des espaces. Le traitement conserve la structure des dossiers. Les fichiers `README.md` et `.gitkeep` ne sont pas considérés comme des images.
