# Boîte à outils dartist

Une collection d’outils web gratuits, réunis dans un studio simple et responsive. Aucun compte ni aucune installation : ouvre la page et utilise les outils directement dans ton navigateur.

**[Ouvrir la boîte à outils](https://dartist-fr.github.io/boite-a-outils/)**

## Les outils disponibles

Depuis la page d’accueil, tu peux accéder aux outils suivants :

| Outil | Fonctionnalités |
| --- | --- |
| **Compresseur d’images** | Compresser, convertir et redimensionner des images, comparer leur poids et télécharger les résultats individuellement ou en ZIP. |
| **Lab HTML / CSS** | Écrire du HTML et du CSS, ajuster l’espace de travail et visualiser le résultat dans un aperçu isolé. |
| **Générateur de QR codes** | Créer des QR codes personnalisés avec différents contenus, formes, couleurs, dégradés, logo, cadre et légende, puis exporter en PNG ou SVG. |
| **Calculatrice & conversions** | Effectuer des calculs et convertir des unités. |
| **Formateur JSON** | Formater, minifier et valider des données JSON. |
| **Palette de couleurs** | Explorer des couleurs et composer des palettes. |
| **Générateur de dégradés CSS** | Composer des dégradés et récupérer le code CSS correspondant. |

Le studio propose une recherche, des filtres par catégorie et un thème clair/sombre. Son interface s’adapte aux écrans d’ordinateur, de tablette et de téléphone.

## Compresseur d’images

**[Ouvrir le compresseur](https://dartist-fr.github.io/boite-a-outils/outils/compresseur.html)**

- Import de plusieurs images et glisser-déposer.
- Conversion vers les formats pris en charge par le navigateur, notamment JPEG, PNG et WebP, ainsi qu’AVIF lorsque disponible.
- Réglage de la qualité et redimensionnement.
- Comparaison du poids avant/après.
- Téléchargement individuel ou regroupement des résultats dans une archive ZIP.

Les images sont traitées localement dans le navigateur et ne sont pas envoyées à un serveur. La prise en charge des formats dépend du navigateur et de ses encodeurs. La création d’archives ZIP utilise JSZip chargé depuis jsDelivr.

## Utilisation et compatibilité

1. Ouvre la [boîte à outils](https://dartist-fr.github.io/boite-a-outils/).
2. Recherche un outil ou parcours les catégories.
3. Utilise les réglages proposés et récupère le résultat.

Un navigateur récent est recommandé. Certaines fonctions chargent des bibliothèques depuis un CDN et nécessitent donc une connexion Internet. Le lab HTML/CSS affiche le code dans un cadre isolé.

## Technologies

- **HTML, CSS et JavaScript** pour l’interface et les outils.
- **GitHub Pages** pour l’hébergement statique.
- **QR Code Styling** pour la génération et la personnalisation des QR codes.
- **JSZip** pour l’export ZIP du compresseur.

## Structure du dossier

```text
boite-a-outils/
├── index.html
├── README.md
└── outils/
    └── compresseur.html
```

Le studio principal est intégré dans `index.html`. Le compresseur d’images dispose de sa propre page dans `outils/compresseur.html`.
