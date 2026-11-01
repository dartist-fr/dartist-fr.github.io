# Salle d’arcade — Jeux2Soirée

**[Jouer en ligne](https://dartist-fr.github.io/jeux2soiree/)**

Salle d’arcade web regroupant des jeux de soirée, de réflexion, d’ambiance et de rapidité. Les jeux se lancent depuis le navigateur, sans installation.

## Jeux disponibles

La page d’accueil de l’arcade donne accès aux expériences suivantes :

- Bataille navale
- Devine-tête
- Fréquence
- Insider
- Le Bobard
- Le Killer
- Loup-garou
- Luxe ou pas luxe
- Monopoly
- Morpion
- Pendu
- Qui est-ce ?
- Quiz de soirée
- Réflexe
- Roue de la chance
- Time’s Up
- Tu préfères
- Undercover
- UNO

La disponibilité du jeu à plusieurs et les règles varient selon le jeu. Les instructions affichées dans chaque jeu et les indications de sa page font référence.

## Accès et compatibilité

- Ouvre la [page de l’arcade](https://dartist-fr.github.io/jeux2soiree/).
- Choisis un jeu depuis la liste.
- Suis les consignes affichées à l’écran.
- Utilise de préférence un navigateur récent sur ordinateur, tablette ou téléphone.

Certains jeux peuvent nécessiter plusieurs joueurs sur le même appareil ou une connexion réseau. Les fonctions multijoueurs ne sont pas uniformes : ne suppose pas qu’un jeu dispose d’un mode en ligne simplement parce qu’il est présent dans l’arcade.

## Structure du projet

Chaque jeu possède généralement son propre dossier et sa page `index.html`. La page principale de l’arcade se trouve à la racine du dossier.

```text
jeux2soiree/
├── index.html
├── bataillenavale/
├── devine-tete/
├── frequence/
├── insider/
├── le-bobard/
├── le-killer/
├── loup-garou/
├── luxe-ou-pas-luxe/
├── monopoly/
├── morpion/
├── pendu/
├── qui-est-ce/
├── quiz-de-soiree/
├── reflexe/
├── roue-de-la-chance/
├── times-up/
├── tu-preferes/
├── undercover/
└── uno/
```

Le dossier `uno-server/` contient les éléments du serveur Node.js associé au mode réseau d’UNO. Son lancement nécessite un environnement serveur Node.js ; GitHub Pages héberge uniquement les pages statiques et ne démarre pas ce serveur.

## Développement

Pour consulter les jeux statiques localement, clone le dépôt principal puis ouvre la page du jeu dans un navigateur :

```bash
git clone https://github.com/dartist-fr/dartist-fr.github.io.git
```

Pour les jeux qui dépendent d’un serveur ou de connexions entre joueurs, suis les instructions propres au jeu et à son serveur. Le dépôt GitHub Pages ne doit pas être considéré comme un hébergement Node.js.

## Signaler un problème

Indique le nom du jeu, l’appareil et le navigateur utilisés, les étapes pour reproduire le problème ainsi que le résultat attendu et le résultat obtenu.
