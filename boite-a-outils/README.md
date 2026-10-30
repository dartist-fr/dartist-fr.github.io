# Boîte à outils dartist

Une collection d’outils web gratuits, réunis dans un studio simple et responsive. Aucun compte ni aucune installation : ouvre la page et utilise les outils directement dans ton navigateur.

**[Ouvrir la boîte à outils](https://dartist-fr.github.io/boite-a-outils/)**

## Les outils disponibles

Depuis la page d’accueil, tu peux accéder aux outils suivants :

| Outil | Fonctionnalités |
| --- | --- |
| **Compresseur d’images** | Compresser, convertir et redimensionner des images, comparer leur poids et télécharger les résultats individuellement ou en ZIP. |
| **Lab HTML / CSS** | Écrire du HTML et du CSS, ajuster l’espace de travail et visualiser le résultat dans un aperçu isolé. |
| **Studio QR** | Créer des QR codes URL, texte, Wi-Fi, vCard, WhatsApp, e-mail, téléphone, SMS et coordonnées GPS ; personnaliser couleurs, dégradés, formes, logo, cadres et légendes ; créer des QR à texture photographique ; générer des lots depuis un CSV ; lire, vérifier et extraire plusieurs QR depuis une image ou une caméra ; exporter PNG, JPG, SVG, PDF et EPS. |
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


## Studio QR

**[Ouvrir le Studio QR](https://dartist-fr.github.io/boite-a-outils/?outil=qr)**

- Création de QR statiques : URL, texte, Wi-Fi, vCard, WhatsApp, e-mail, téléphone, SMS et géolocalisation.
- Personnalisation : palettes, dégradés, formes de modules et de repères, niveau de correction, logo, marge, cadres et légendes.
- QR photographiques : la photo est utilisée comme texture dans les modules sombres ; un contrôle de décodage local est proposé avant export.
- Séries : import CSV, préparation jusqu’à 300 codes, téléchargements PNG individuels, ZIP et planches d’impression A4, A3 ou Letter configurables.
- Lecture : import d’image, lecture caméra lorsque le navigateur l’autorise, extraction multi-QR avec recherche par zones, copie groupée et export CSV.
- Contrôle : diagnostic de contraste global et test de décodage local. Ces contrôles ne remplacent pas un essai sur plusieurs téléphones ni une vérification après impression.
- Exports : PNG, JPG, PDF, SVG vectoriel et EPS vectoriel. L’EPS utilise une couleur unie et n’intègre pas le logo ; le SVG conserve le dégradé et le logo.
- Interface simplifiée en étapes repliables : contenu, design, puis cadre et marge. Le sélecteur de pictogrammes propose une recherche par catégories ; le symbole est intégré au centre du QR, sans découpe de la matrice extérieure. Thèmes : sauvegarde, import et export dans le stockage local du navigateur.

La génération et l’analyse des QR sont réalisées côté navigateur. Les bibliothèques QR, ZIP et PDF sont chargées depuis des CDN et nécessitent une connexion Internet. Les QR dynamiques, statistiques hébergées, comptes, bibliothèque cloud et collaboration demandent un service serveur et ne sont pas activés dans cette version.

## Utilisation et compatibilité

1. Ouvre la [boîte à outils](https://dartist-fr.github.io/boite-a-outils/).
2. Recherche un outil ou parcours les catégories.
3. Utilise les réglages proposés et récupère le résultat.

Un navigateur récent est recommandé. Certaines fonctions chargent des bibliothèques depuis un CDN et nécessitent donc une connexion Internet. Le lab HTML/CSS affiche le code dans un cadre isolé.

## Technologies

- **HTML, CSS et JavaScript** pour l’interface et les outils.
- **GitHub Pages** pour l’hébergement statique.
- **QR Code Styling** et **qrcode-generator** pour la génération, la matrice et les exports vectoriels des QR codes.
- **jsQR** et l’API **BarcodeDetector** lorsqu’elle est prise en charge pour la lecture des QR codes.
- **JSZip** pour les archives ZIP et **jsPDF** pour les exports PDF.
- **JSZip** pour l’export ZIP du compresseur.

## Structure du dossier

```text
boite-a-outils/
├── index.html
├── README.md
├── assets/
│   └── js/
│       └── qr-atelier.js
└── outils/
    ├── qr.html
    └── compresseur.html
```

Le studio principal est intégré dans `index.html`. Le compresseur d’images dispose de sa propre page dans `outils/compresseur.html`.


### Silhouettes QR

Le Studio QR propose des enveloppes en forme de poisson, cœur, étoile, chat, chien, papillon, maison, ballon, cercle et autres formes. Le QR est conservé comme une **matrice carrée complète** : aucun module n'est retiré ni déplacé. Il est placé au centre de la silhouette, sur un fond contrasté, avec sa zone de silence et ses trois repères de position (les trois carrés des coins) intacts. La silhouette forme le contour extérieur qui contient le code ; elle ne découpe plus les données QR. **Pixelated edge** règle le rendu du contour de la silhouette. Le lecteur local vérifie le QR complet lorsqu'il est disponible ; un scan réel reste recommandé avant impression ou diffusion. PNG, JPG et PDF reprennent l'aperçu ; SVG conserve la silhouette et la matrice complète. EPS reste un export QR carré.
