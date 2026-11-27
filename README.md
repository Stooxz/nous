# Nous

Notre petit coin : nos photos, protégées par un mot de passe, et un studio photomaton.

Les photos sont **chiffrées sur ton PC** avant d'être publiées. Le dépôt est public, mais on n'y trouve que des fichiers `.bin` illisibles sans le mot de passe. Les originaux ne quittent jamais ton ordinateur.

## Ajouter ou changer les photos

1. Mets les photos dans `photos-src/nous/` et `photos-src/mon-copain/` (JPEG, PNG ou HEIC d'iPhone). Elles s'affichent dans l'ordre alphabétique des noms de fichiers.
2. Dans le dossier du projet, lance :

   ```
   npm run encrypt
   ```

   Tape le mot de passe deux fois (rien ne s'affiche à l'écran, c'est normal).
   - Pour ajouter des photos plus tard, garde **le même mot de passe** : le script te prévient si ce n'est pas le cas.
   - Les majuscules, les accents et les espaces au début ou à la fin ne comptent pas : « Chérie », « cherie » et « CHERIE » ouvrent tous le site.
3. Facultatif : `photos-src/legendes.json` est créé au premier lancement. Ajoutes-y une légende ou une date par photo, puis relance `npm run encrypt`.
4. Facultatif : écris « Le mot de la fin » dans `content/message.md`, puis relance `npm run encrypt`. Le message est chiffré avec les photos.

`photos-src/` et `content/` ne sont **jamais** envoyés sur GitHub (ils sont dans `.gitignore`).

## Le morceau du 25 décembre

1. Mets ton enregistrement dans `photos-src/audio/` (MP3 ou M4A, par exemple `piano.mp3`). Un seul morceau à la fois.
2. Écris le titre et la dédicace dans `photos-src/noel.json` (il est créé au premier `npm run encrypt`) :

   ```json
   { "titre": "Pour toi", "dedicace": "Joyeux Noël, mon amour." }
   ```
3. Relance `npm run encrypt` avec **le même mot de passe**, puis mets en ligne (ci-dessous). À faire **avant le 24 décembre au soir**.

Le morceau est chiffré comme les photos. Le lien direct à lui envoyer : `https://stooxz.github.io/nous/#/noel`. Avant le 25 décembre à minuit (heure de Paris), elle ne voit qu'un compte à rebours ; ensuite, le lecteur et le bouton « Télécharger le morceau ». Si le morceau n'est pas encore en ligne, elle lit « Le morceau arrive très bientôt ».

S'il pèse plus de 20 Mo, le script te prévient : exporte-le en MP3 à 192 kb/s.

Pour l'essayer avant le 25 sur ton PC : `npm run dev`, puis ouvre `http://localhost:5173/nous/?simuler=2026-12-25#/noel`. Ça ne marche pas sur le site en ligne.

## Mettre en ligne

```
git add -A
git status
git commit -m "Photos"
git push
```

Avant le commit, `git status` ne doit lister **aucune** photo (.jpg, .png, .heic) ni musique (.mp3, .m4a) : seulement des fichiers dans `public/data/`.

Après le push, GitHub publie le site tout seul en une ou deux minutes, sur `https://<ton-pseudo>.github.io/nous/`.

La toute première fois, sur GitHub : **Settings → Pages → Source : GitHub Actions**.

## Modifier les textes

La phrase d'accueil, l'indice, les messages en cas de mauvais mot de passe et le texte par défaut des bandes sont dans `src/config.json`. Ce fichier n'est pas chiffré : n'y mets jamais le mot de passe.

## Pour essayer sur ton PC

```
npm install
npm run dev
```

Puis ouvre l'adresse affichée (http://localhost:5173/nous/).
