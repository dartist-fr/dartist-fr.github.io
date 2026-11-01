# Mes applications

Cette rubrique rassemble les applications développées par dartist. Chaque projet conserve son propre dépôt et son historique ; les versions installables sont publiées dans les Releases GitHub correspondantes.

## Automa

Automa est une application Android consacrée à la personnalisation de l’écran d’accueil et aux widgets.

- **[Présentation sur le site](automa.html)**
- **[Télécharger l’APK Automa 0.15.0](https://github.com/dartist-fr/automa/releases/download/v0.15.0/Automa-0_15_0.apk)**
- [Toutes les versions et notes de publication](https://github.com/dartist-fr/automa/releases)
- [Dépôt GitHub](https://github.com/dartist-fr/automa)

La version 0.15.0 est la dernière Release vérifiée lors de la mise à jour de cette documentation. Consulte sa page de publication pour les informations propres à cette version.

## FlowMind

FlowMind est une application de workflows disponible sur le web et sous forme d’APK Android. La version documentée est un MVP : les workflows sont stockés localement et le bouton de test effectue une simulation, sans exécuter d’action externe.

- **[Version web](https://dartist-fr.github.io/FlowMind/)**
- **[Télécharger FlowMind 0.1.0 (APK)](https://github.com/dartist-fr/FlowMind/releases/download/v0.1.0/FlowMind-v0.1.0.apk)**
- [Toutes les versions et notes de publication](https://github.com/dartist-fr/FlowMind/releases)
- [Dépôt GitHub](https://github.com/dartist-fr/FlowMind)

La version 0.1.0 est la dernière Release stable vérifiée lors de la mise à jour de cette documentation. Les builds automatiques de la branche principale peuvent être publiés séparément comme versions nightly/préliminaires.

## Cloner le dépôt principal et son sous-module

Le dossier `Automa` du dépôt principal est un sous-module Git qui référence un commit précis du dépôt indépendant. Pour cloner le site avec le sous-module initialisé :

```bash
git clone --recurse-submodules https://github.com/dartist-fr/dartist-fr.github.io.git
```

Les APK ne sont pas stockés dans le dépôt du site : ils restent hébergés dans les Releases de chaque projet afin d’éviter les doublons et de conserver un historique clair des versions.
