# Boîte à outils dartist

Un studio d’outils web réunis sur une seule page, accessible directement dans le navigateur, sans installation.

**Accès au studio :** https://dartist-fr.github.io/boite-a-outils/  
**Compresseur d’images :** https://dartist-fr.github.io/boite-a-outils/compresseur.html

## Le studio

La page d’accueil du studio regroupe neuf outils :

1. **Formateur JSON** — formater, minifier et valider du JSON.
2. **Atelier de texte** — manipuler et analyser du texte avec des utilitaires dédiés.
3. **Encodeur & décodeur** — encoder ou décoder des données URL et Base64.
4. **Générateur de mots de passe** — créer des mots de passe personnalisés.
5. **Palette de couleurs** — générer et explorer des combinaisons de couleurs.
6. **Générateur de dégradés** — composer des dégradés CSS et récupérer le code correspondant.
7. **QR code personnalisé** — générer un QR code et ajuster son apparence.
8. **Calculatrice & conversions** — effectuer des calculs et convertir des unités.
9. **Lab HTML / CSS** — tester du HTML et du CSS dans un aperçu intégré isolé.

La recherche et les filtres par catégorie aident à retrouver rapidement un outil. L’interface est responsive et comprend un basculement de thème.

## Générateur de QR codes

Le générateur permet de personnaliser le contenu et l’apparence du QR code :

- **Contenu :** URL, texte, e-mail, Wi-Fi, téléphone et SMS.
- **Formes :** styles du corps du QR, du contour des repères et de leur centre.
- **Couleurs :** couleur du QR, fond, couleur des repères et dégradé linéaire ou radial.
- **Logo :** ajout d’une image personnelle au centre et réglage de sa taille.
- **Présentation :** marge, cadre et légende.
- **Sortie :** choix de la résolution et export en PNG ou SVG.

Les vignettes de formes sont générées avec la même bibliothèque que le QR final afin de donner un aperçu cohérent des options choisies.

## Compresseur d’images

Le compresseur est conservé sur une page distincte : [ouvrir le compresseur](https://dartist-fr.github.io/boite-a-outils/compresseur.html).

Il prend en charge l’import de plusieurs images, le glisser-déposer, la conversion vers les formats compatibles avec le navigateur (notamment JPEG, PNG et WebP, ainsi qu’AVIF lorsque disponible), le réglage de qualité, le redimensionnement, la comparaison des tailles et le téléchargement individuel ou en ZIP.

La prise en charge effective dépend du navigateur et de ses encodeurs intégrés. Les images sont traitées localement dans le navigateur et ne sont pas envoyées à un serveur. La création d’archives ZIP utilise JSZip chargé depuis jsDelivr.

## Utilisation et compatibilité

- Aucune installation n’est nécessaire : ouvrez simplement le [studio](https://dartist-fr.github.io/boite-a-outils/) dans un navigateur récent.
- L’interface s’adapte aux écrans d’ordinateur, de tablette et de téléphone.
- Certaines fonctions s’appuient sur des bibliothèques chargées depuis un CDN ; une connexion Internet peut donc être nécessaire pour les utiliser.
- Le lab HTML/CSS exécute l’aperçu dans un cadre isolé.

## Technologies

Le studio est une page web statique en HTML, CSS et JavaScript, publiée avec GitHub Pages. Le générateur QR utilise la bibliothèque [QR Code Styling](https://github.com/kozakdenys/qr-code-styling).
