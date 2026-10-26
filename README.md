# dartist — Hub de projets

Bienvenue sur le dépôt qui héberge le **hub de projets dartist** : un point d’entrée vers plusieurs créations web, jeux et expériences interactives.

🌐 **Site en ligne :** https://dartist-fr.github.io/  
📦 **Dépôt :** https://github.com/dartist-fr/dartist-fr.github.io

## Présentation

Le site rassemble les projets dans une interface simple et responsive. Depuis la page d’accueil, vous pouvez accéder aux espaces suivants :

- **Salle d’arcade** — une collection de jeux jouables dans le navigateur, pensée pour les soirées entre amis.
- **Portfolio** — une vitrine consacrée aux photographies.
- **Boîte à outils** — un espace prévu pour regrouper des utilitaires.
- **Le Labo** — un espace de prototypes et d’expériences présenté comme privé sur la page d’accueil.

Le contenu et la disponibilité de chaque espace peuvent évoluer au fil du développement.

## Fonctionnalités de la page d’accueil

- Interface adaptée aux différentes tailles d’écran.
- Thème clair et thème sombre, avec préférence mémorisée dans le navigateur.
- Navigation vers les différentes sections du hub.
- Fenêtre d’accès pour l’espace « Le Labo ».

> **Note de sécurité :** la fenêtre d’accès du Labo est implémentée côté navigateur dans le code de la page d’accueil. Elle ne doit pas être considérée comme une protection de sécurité pour des données ou ressources confidentielles. Pour protéger réellement un espace privé, il faut mettre en place un contrôle d’accès côté serveur ou une solution d’authentification adaptée.

## Technologies

La page d’accueil repose sur des technologies web standards :

- **HTML** pour la structure ;
- **CSS** pour la mise en page, le thème et l’adaptation aux écrans ;
- **JavaScript** pour le changement de thème et les interactions de l’interface ;
- **Google Fonts** pour les polices Fraunces, Inter et IBM Plex Mono.

Aucune étape de compilation n’est nécessaire pour la page d’accueil telle qu’elle est écrite actuellement.

## Lancer le projet en local

1. Clonez le dépôt :

   ```bash
   git clone https://github.com/dartist-fr/dartist-fr.github.io.git
   ```

2. Entrez dans le dossier :

   ```bash
   cd dartist-fr.github.io
   ```

3. Ouvrez `index.html` dans votre navigateur.

Pour tester le site dans un environnement local plus proche d’un hébergement web, vous pouvez également lancer un serveur HTTP statique depuis la racine du dépôt, par exemple :

```bash
python -m http.server 8000
```

Puis ouvrez http://localhost:8000/.

## Structure générale

La racine contient notamment :

- `index.html` — page d’accueil du hub, styles et interactions principales ;
- `jeux2soiree/` — espace de jeux ;
- `portfolio/` — espace portfolio ;
- `labo/` — espace de prototypes ;
- les ressources statiques référencées par les pages, comme les images et le favicon.

Les sous-dossiers peuvent posséder leurs propres fichiers et dépendances. Consultez leurs fichiers respectifs pour connaître leurs instructions spécifiques.

## Déploiement

Le dépôt utilise le nom `dartist-fr.github.io`, adapté à un hébergement GitHub Pages pour le compte `dartist-fr`. Si GitHub Pages est activé dans les paramètres du dépôt, le site est accessible à l’adresse :

https://dartist-fr.github.io/

Après une modification, publiez les changements sur la branche configurée dans les paramètres GitHub Pages pour mettre le site à jour.

## Contributions et retours

Les suggestions, corrections et idées d’amélioration sont les bienvenues. Avant de proposer une modification, vérifiez qu’elle ne casse pas la navigation ni les espaces existants.

Pour toute question, la page d’accueil indique le contact suivant : **flawz.ad@gmail.com**.

## Licence

Aucune licence open source n’est spécifiée ici. Sauf indication contraire dans le dépôt, ne présumez pas que le code peut être réutilisé ou redistribué librement.
