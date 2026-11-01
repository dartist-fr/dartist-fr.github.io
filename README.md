# dartist — Hub de projets

Un hub personnel qui rassemble les projets web, les jeux jouables dans le navigateur, les outils pratiques, les applications et les photographies de dartist.

🌐 **[Accéder au site dartist](https://dartist-fr.github.io/)**

## Explorer le site

- **[Salle d’arcade](https://dartist-fr.github.io/jeux2soiree/)** — collection de jeux accessibles depuis le navigateur, pour jouer seul ou à plusieurs selon le jeu.
- **[Mes applications](https://dartist-fr.github.io/mes%20applications/)** — présentations et téléchargements d’Automa et FlowMind.
- **[Boîte à outils](https://dartist-fr.github.io/boite-a-outils/)** — studio d’utilitaires web : compresseur d’images, Studio QR, Visualiseur HTML/CSS/JavaScript, formateur JSON, couleurs, dégradés et calculs.
- **Le Labo** — prototypes et expériences en cours.
- **[Portfolio photo](https://dartist-fr.github.io/portfolio/)** — séries photographiques consacrées notamment aux voyages, au sport et aux événements.

## Boîte à outils

La Boîte à outils fonctionne directement dans un navigateur récent, sans compte ni installation.

- **Compresseur d’images** — traitement de plusieurs images, conversion, redimensionnement, réglage de qualité, comparaison avant/après et export individuel ou ZIP.
- **Studio QR** — création de QR codes personnalisés, contenus variés, formes et couleurs, lots CSV, lecture de codes et exports.
- **Visualiseur HTML / CSS / JS** — trois éditeurs séparés dont les contenus sont réunis dans un même aperçu en direct. L’aperçu s’exécute dans une iframe isolée ; l’espace de travail peut être redimensionné et le résultat ouvert dans un nouvel onglet.
- **Autres outils** — formateur JSON, palette de couleurs, générateur de dégradés CSS, calculatrice et conversions.

Le traitement des images et la génération/lecture des QR sont réalisés dans le navigateur. Certaines bibliothèques sont chargées depuis des CDN : une connexion Internet peut donc être nécessaire. Les limites de prise en charge dépendent du navigateur.

➡️ **[Ouvrir la Boîte à outils](https://dartist-fr.github.io/boite-a-outils/)**

## Applications

- [Automa — dépôt et versions Android](https://github.com/dartist-fr/automa)
- [FlowMind — application web, dépôt et versions Android](https://github.com/dartist-fr/FlowMind)

Les APK distribués sont publiés dans les Releases GitHub de chaque projet. Consulte les notes et les fichiers de chaque version avant installation.

## Dépôts associés

- [Site principal — sources du hub](https://github.com/dartist-fr/dartist-fr.github.io)
- [Portfolio photographique](https://github.com/dartist-fr/portfolio)
- [Automa](https://github.com/dartist-fr/automa)
- [FlowMind](https://github.com/dartist-fr/FlowMind)

## Technologies et hébergement

Le hub utilise principalement **HTML, CSS et JavaScript** et est publié avec **GitHub Pages**. Les outils et projets indépendants peuvent utiliser leurs propres dépendances et workflows.

## Lancer le site en local

Clone le dépôt puis ouvre `index.html` dans un navigateur :

```bash
git clone https://github.com/dartist-fr/dartist-fr.github.io.git
```

Les pages statiques peuvent être consultées sans compilation. Certaines fonctions nécessitent toutefois une connexion Internet pour charger leurs bibliothèques externes. Les fonctions reposant sur un serveur ou une connexion multijoueur doivent être utilisées dans leur environnement prévu.

---

*Documentation du hub : elle décrit les projets et outils présents dans le dépôt, pas les fonctionnalités futures qui ne sont pas encore publiées.*
