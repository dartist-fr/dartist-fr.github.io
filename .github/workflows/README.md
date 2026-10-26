# Workflows GitHub Actions

Ce dossier contient les workflows d’automatisation du dépôt, exécutés par GitHub Actions.

## `portfolio-auto.yml` — Actualiser le portfolio

Ce workflow régénère le manifeste des photos à partir de l’arborescence du dossier `portfolio/images/`.

### Déclenchement

- Lors d’un push sur la branche `main` qui modifie `portfolio/images/**`, `scripts/generate-portfolio.py` ou le workflow lui-même.
- Manuellement via **GitHub → Actions → Actualiser le portfolio → Run workflow**.

### Étapes

1. Récupère le dépôt.
2. Exécute `python3 scripts/generate-portfolio.py`.
3. Vérifie si `portfolio/images-manifest.json` a changé.
4. Si nécessaire, crée un commit avec le compte GitHub Actions puis pousse le manifeste mis à jour.

Le workflow utilise une permission d’écriture sur le contenu du dépôt pour enregistrer le manifeste. Si le manifeste ne change pas, aucun commit supplémentaire n’est créé.

### Vérification

Consultez l’onglet **Actions** du dépôt pour voir les exécutions, leurs journaux et leurs éventuelles erreurs.
