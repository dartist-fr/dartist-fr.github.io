# Mes applications

Cette rubrique rassemble les applications développées par dartist. Les projets conservent chacun leur dépôt et leur historique, tandis que les fichiers distribuables sont publiés dans leurs Releases GitHub.

## Automa

Automa est un projet Android consacré à la personnalisation de l’écran d’accueil et aux widgets.

- **[Découvrir Automa sur le site](automa.html)** — présentation du projet et accès rapide aux téléchargements.
- **[Télécharger la dernière version](https://github.com/dartist-fr/automa/releases/latest)** — ouvrir la dernière Release, puis choisir l’APK dans la section « Assets ».
- **[Toutes les versions et notes de publication](https://github.com/dartist-fr/automa/releases)** — retrouver les versions précédentes.
- **[Dépôt et code source](https://github.com/dartist-fr/automa)** — consulter le projet et son historique Git.

Le dossier `Automa` est un sous-module Git qui référence un commit précis du dépôt indépendant. Pour cloner le site avec le sous-module initialisé, utilisez :

```bash
git clone --recurse-submodules https://github.com/dartist-fr/dartist-fr.github.io.git
```

Les APK ne sont pas stockés dans le dépôt du site : ils restent hébergés dans les Releases du dépôt Automa afin d’éviter les doublons et de conserver un historique clair des versions.
