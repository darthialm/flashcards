# Flashcards Leitner (secourisme / incendie)

Page statique : `index.html` + `cards.js`. Aucune installation nécessaire.

## Méthode (3 boîtes)
- Boîte 1 : révision chaque jour
- Boîte 2 : tous les 3 jours
- Boîte 3 : tous les 7 jours
- Bonne réponse : la carte monte d'une boîte. Mauvaise réponse : retour en boîte 1.

La progression est enregistrée dans le navigateur (localStorage), sur chaque appareil.
Utilise « Exporter / Importer ma progression » pour la transférer d'un appareil à l'autre.

## Publier sur GitHub Pages
1. Crée un dépôt GitHub (par exemple `flashcards`).
2. Ajoute les fichiers `index.html`, `cards.js` (et ce README) à la racine.
3. Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
4. Après une minute, la page est disponible sur `https://<ton-pseudo>.github.io/flashcards/`.

## Onglet Manœuvres (enchaînements en photos)
`sequences.js` décrit chaque manœuvre étape par étape (texte + photo dans `images/`).
La page en fait des cartes : photo de la position actuelle -> « Que fait-on ensuite ? » -> étape suivante avec sa photo.
Ces cartes suivent le même système Leitner que les autres.
Pour ajouter une manœuvre : dépose les photos dans `images/` et ajoute un bloc dans `SEQUENCES` (voir les exemples dans le fichier).
Ces cartes ne viennent pas du Google Sheet (il ne contient pas d'images).

Attention : les photos viennent de documents de formation (SDIS 33, BMPM / SDIS 59). Pour un usage perso, garde le dépôt privé ou ne publie pas le site si ces documents ne sont pas libres de diffusion.

## Ajouter des cartes
Les cartes sont lues directement dans le Google Sheet (1er onglet, colonnes Question / Réponse / Catégorie) à chaque ouverture de la page.
- Colonne Catégorie = `INCENDIE` : la carte va dans Incendie. Toute autre valeur : Secourisme.
- Les lignes sans question ou sans réponse (lignes vides, titres de section) sont ignorées.
- Le Sheet doit rester partagé par lien (« Tous les utilisateurs disposant du lien »).
- Si le Sheet est inaccessible, la page utilise les dernières cartes synchronisées, ou à défaut celles de `cards.js`.

La progression d'une carte est liée à son texte de question : si tu modifies la question, la carte repart en boîte 1.
