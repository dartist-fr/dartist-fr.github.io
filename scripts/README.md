# Scripts du dépôt

Ce dossier contient les scripts utilitaires qui automatisent la gestion du site.

## `generate-portfolio.py`

Génère `portfolio/images-manifest.json` à partir des dossiers d’images présents dans `portfolio/images/`.

Le script :
- parcourt les dossiers et sous-dossiers d’images ;
- détecte les fichiers image pris en charge : JPG, JPEG, PNG, WEBP, AVIF et GIF ;
- construit les séries, sous-séries, listes de photos et couvertures dans le manifeste ;
- écrit le JSON en UTF-8 avec une indentation lisible.

### Exécution locale

Depuis la racine du dépôt, avec Python 3 :

```bash
python3 scripts/generate-portfolio.py
```

Le fichier `portfolio/images-manifest.json` est alors mis à jour. Vérifiez les changements avant de les valider dans Git.

Le workflow GitHub Actions `.github/workflows/portfolio-auto.yml` exécute automatiquement ce script lorsque les chemins surveillés changent sur `main`, ou à la demande depuis l’onglet Actions.
