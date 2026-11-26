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

## Mettre en ligne

```
git add -A
git status
git commit -m "Photos"
git push
```

Avant le commit, `git status` ne doit lister **aucune** photo (.jpg, .png, .heic) : seulement des fichiers dans `public/data/`.

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
