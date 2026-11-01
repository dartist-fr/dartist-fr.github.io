# Boîte à outils dartist

Un studio d’outils web gratuits, réunis dans une interface responsive. Aucun compte ni aucune installation : ouvre la page et utilise les outils directement dans un navigateur récent.

**[Ouvrir la Boîte à outils](https://dartist-fr.github.io/boite-a-outils/)**

## Outils disponibles

| Outil | Fonctionnalités principales |
| --- | --- |
| **Compresseur d’images** | Import multiple, compression, conversion, redimensionnement, comparaison du poids et export individuel ou ZIP. |
| **Visualiseur HTML / CSS / JS** | Trois éditeurs indépendants, aperçu fusionné en direct, exécution JavaScript isolée, panneaux redimensionnables et ouverture du résultat dans un nouvel onglet. |
| **Studio QR** | QR URL, texte, Wi-Fi, vCard, WhatsApp, e-mail, téléphone, SMS et coordonnées GPS ; personnalisation graphique, QR photographiques, lots CSV, lecture et exports. |
| **Calculatrice & conversions** | Calculs et conversions d’unités. |
| **Formateur JSON** | Formatage, minification et validation de JSON. |
| **Palette de couleurs** | Exploration et composition de palettes. |
| **Générateur de dégradés CSS** | Création de dégradés et récupération du code CSS. |

La page d’accueil comprend une recherche, des filtres par catégorie et un thème clair/sombre. L’interface s’adapte aux écrans d’ordinateur, de tablette et de téléphone.

## Visualiseur HTML / CSS / JS

Le Visualiseur réunit les trois langages dans **un seul rendu** :

1. Colle ou écris la structure de la page dans l’éditeur HTML.
2. Ajoute les styles dans l’éditeur CSS.
3. Ajoute les interactions dans l’éditeur JavaScript.
4. Clique sur **Actualiser** pour reconstruire l’aperçu avec les trois contenus.

L’aperçu est rendu dans une iframe avec l’attribut `sandbox="allow-scripts"`. Le JavaScript fourni peut donc s’exécuter dans ce cadre, sans accès direct au document parent. L’outil propose également :

- des onglets pour passer de HTML à CSS et JavaScript ;
- un aperçu actualisable ;
- un séparateur horizontal pour ajuster la largeur éditeur/aperçu ;
- un réglage de largeur et un séparateur pour ajuster la hauteur de l’espace de travail ;
- les commandes **Réinitialiser** et **Tout effacer** ;
- l’ouverture du rendu dans un nouvel onglet.

Le bac à sable n’est pas un environnement d’hébergement ni un serveur de développement. Les API navigateur, ressources externes et comportements dépendant d’un serveur peuvent avoir des limites. N’exécute que du code auquel tu fais confiance.

## Compresseur d’images

**[Ouvrir le compresseur](https://dartist-fr.github.io/boite-a-outils/outils/compresseur.html)**

- Import de plusieurs images et glisser-déposer.
- Conversion vers les formats pris en charge par le navigateur, notamment JPEG, PNG et WebP ; AVIF lorsque l’encodeur du navigateur le permet.
- Réglage de la qualité et redimensionnement.
- Comparaison du poids avant/après.
- Téléchargement individuel ou regroupement des résultats dans une archive ZIP.

Les images sont traitées localement dans le navigateur et ne sont pas envoyées à un serveur par le compresseur. La prise en charge des formats dépend du navigateur et de ses encodeurs. La création d’archives ZIP utilise JSZip chargé depuis un CDN.

## Studio QR

**[Ouvrir le Studio QR](https://dartist-fr.github.io/boite-a-outils/?outil=qr)**

- **Contenus :** URL, texte, Wi-Fi, vCard, WhatsApp, e-mail, téléphone, SMS et géolocalisation.
- **Personnalisation :** couleurs, dégradés, formes des modules et repères, niveau de correction, logo, marge, cadres et légendes.
- **QR photographiques :** utilisation d’une photo comme texture dans les modules sombres, avec contrôle de décodage local proposé avant export.
- **Séries :** import CSV, préparation de lots, téléchargements PNG individuels, ZIP et planches d’impression configurables.
- **Lecture :** import d’image, caméra lorsque le navigateur l’autorise, extraction de plusieurs QR, copie groupée et export CSV.
- **Contrôle :** diagnostic de contraste et test de décodage local. Ces contrôles ne remplacent pas un essai sur plusieurs téléphones ni une vérification après impression.
- **Exports :** PNG, JPG, PDF, SVG et EPS. Certaines caractéristiques graphiques peuvent varier selon le format ; les limites affichées dans l’outil font foi.
- **Préférences :** sauvegarde, import et export des thèmes dans le stockage local du navigateur.

La génération et l’analyse sont effectuées côté navigateur. Les bibliothèques QR, ZIP et PDF sont chargées depuis des CDN et nécessitent une connexion Internet. Les QR dynamiques hébergés, statistiques distantes, comptes, bibliothèque cloud et collaboration ne sont pas fournis par cette version statique.

## Utilisation et compatibilité

1. Ouvre la [Boîte à outils](https://dartist-fr.github.io/boite-a-outils/).
2. Recherche un outil ou parcours les catégories.
3. Utilise les réglages proposés puis récupère le résultat.

Un navigateur récent est recommandé. Certaines fonctions chargent des bibliothèques depuis un CDN et nécessitent donc une connexion Internet. L’accès à la caméra dépend du navigateur, des permissions et généralement d’un contexte sécurisé HTTPS.

## Technologies

- **HTML, CSS et JavaScript** pour l’interface et les outils.
- **GitHub Pages** pour l’hébergement statique.
- **QR Code Styling** et **qrcode-generator** pour la génération des QR codes.
- **jsQR** et l’API **BarcodeDetector** lorsqu’elle est prise en charge pour la lecture.
- **JSZip** pour les archives ZIP.
- **jsPDF** pour les exports PDF.

## Structure du dossier

```text
boite-a-outils/
├── index.html
├── README.md
├── assets/
│   └── js/
│       └── qr-atelier.js
└── outils/
    ├── calculator.html
    ├── colors.html
    ├── compresseur.html
    ├── gradient.html
    ├── json.html
    ├── playground.html
    └── qr.html
```

Le studio et ses vues sont pilotés depuis `index.html`. Les pages dédiées des outils sont regroupées dans `outils/`. Les scripts et styles partagés sont rangés dans `assets/`.

---

*Ce README décrit les fonctions présentes dans la version du dépôt. Les fonctions nécessitant un service distant ne sont pas promises par cette version statique.*
