# Dartist Widgets

Compagnon Android natif pour recevoir une configuration JSON exportée depuis le Studio Widgets Dartist, puis demander au launcher d'ajouter un App Widget à l'écran d'accueil.

## Parcours utilisateur prévu

1. Installer l'APK de Dartist Widgets.
2. Ouvrir le Studio Widgets Dartist dans Chrome.
3. Choisir un modèle, une apparence, une typographie et un format.
4. Appuyer sur **Ajouter ce widget sur mon Android** et choisir Dartist Widgets dans la feuille de partage Android.
5. Dans Dartist Widgets, appuyer sur **Ajouter à l'écran d'accueil**.
6. Confirmer la demande présentée par Android.

Android et le launcher gardent le contrôle final de l'ajout. Certains launchers peuvent refuser l'épinglage direct ; l'application indique alors comment passer par le sélecteur de widgets.

## Build

Le projet utilise Kotlin, Android Gradle Plugin, Gradle et Jetpack Glance.

- JDK 17
- Android SDK Platform 36
- Gradle 8.13
- Android Gradle Plugin 8.13.2
- Jetpack Glance AppWidget 1.2.0

Depuis ce dossier :

```bash
gradle :app:assembleDebug
```

Le workflow GitHub Actions du dépôt compile automatiquement l'application et publie l'APK Debug en artefact de workflow.

## Limites du prototype

- Les widgets sont de vrais App Widgets Android, mais le rendu natif initial est volontairement simple.
- Les choix de couleurs, de thème, de format, de libellé et de famille typographique sont reçus depuis le site. Les familles Google Fonts ne sont pas embarquées dans cet APK : Android utilise des familles système proches pour le moment.
- Météo, musique, santé, écouteurs et statistiques sont des valeurs de démonstration tant que les autorisations et fournisseurs de données correspondants ne sont pas intégrés.
- La fréquence de mise à jour déclarée est de 30 minutes. L'actualisation exacte des horloges et des données dynamiques reste à améliorer.
- L'APK Debug généré par CI est destiné aux essais. Une distribution durable nécessitera une clé de signature de publication conservée.

## Références Android

- App Widgets : https://developer.android.com/develop/ui/views/appwidgets
- Jetpack Glance : https://developer.android.com/develop/ui/compose/glance
- Épinglage d'un widget : https://developer.android.com/develop/ui/views/appwidgets/discoverability
