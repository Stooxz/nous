// npm run encrypt : redimensionne, nettoie (EXIF/GPS) et chiffre les photos de photos-src/
// vers public/data/. Le mot de passe est seulement tapé dans le terminal, jamais écrit.
import { readFile, writeFile, readdir, rm, mkdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import readline from 'node:readline';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { normaliser } from '../src/motdepasse.js';

const SRC = 'photos-src';
const OUT = 'public/data';
const LEGENDES = `${SRC}/legendes.json`;
const MESSAGE = 'content/message.md';
const CATEGORIES = ['nous', 'mon-copain'];
const ITERATIONS = 600_000;
const EXT = /\.(jpe?g|png|heic|heif|webp|avif|tiff?)$/i;
const { subtle } = globalThis.crypto;

// --- saisie du mot de passe (masquée dans un vrai terminal, ligne par ligne sinon) ---
const lignes = process.stdin.isTTY ? null : readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();

function demander(question, masque = true) {
  process.stdout.write(question);
  if (lignes) return lignes.next().then(({ value }) => (process.stdout.write('\n'), value ?? ''));
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let s = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const surTouche = (texte) => {
      for (const c of texte) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', surTouche);
          process.stdout.write('\n');
          return resolve(s);
        }
        if (c === '\u0003') process.exit(130); // Ctrl+C
        if (c === '\u007f' || c === '\b') {
          if (s) { s = [...s].slice(0, -1).join(''); process.stdout.write('\b \b'); }
        } else if (c >= ' ') {
          s += c;
          process.stdout.write(masque ? '•' : c);
        }
      }
    };
    stdin.on('data', surTouche);
  });
}

// --- crypto : même format que src/crypto.ts (IV 12 octets + texte chiffré AES-GCM) ---
async function deriverCle(motDePasse, sel, iterations) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(normaliser(motDePasse)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function chiffrer(cle, donnees) {
  const iv = randomBytes(12); // IV unique par fichier
  return Buffer.concat([iv, Buffer.from(await subtle.encrypt({ name: 'AES-GCM', iv }, cle, donnees))]);
}
async function dechiffrer(cle, buf) {
  return Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, cle, buf.subarray(12)));
}

const existe = (p) => access(p).then(() => true, () => false);
const triNaturel = (a, b) => a.localeCompare(b, 'fr', { numeric: true });

// --- 1. liste des photos ---
for (const c of CATEGORIES) await mkdir(`${SRC}/${c}`, { recursive: true });
const photos = [];
for (const cat of CATEGORIES) {
  for (const f of (await readdir(`${SRC}/${cat}`)).filter((f) => EXT.test(f)).sort(triNaturel)) photos.push({ cat, src: `${cat}/${f}` });
}
if (!photos.length) {
  console.log(`Aucune photo trouvée. Mets tes photos dans ${SRC}/nous/ et ${SRC}/mon-copain/ puis relance.`);
  process.exit(1);
}

// --- 2. légendes : on ajoute au modèle les photos qui n'y sont pas encore ---
const legendes = (await existe(LEGENDES)) ? JSON.parse(await readFile(LEGENDES, 'utf8')) : {};
for (const p of photos) legendes[p.src] ??= { legende: '', date: '' };
await writeFile(LEGENDES, JSON.stringify(legendes, null, 2) + '\n');

// --- 3. message de la fin (facultatif) ---
await mkdir('content', { recursive: true });
if (!(await existe(MESSAGE))) {
  await writeFile(MESSAGE, '<!-- Écris ici « Le mot de la fin ». Laisse vide pour ne pas afficher la page.\n     Une ligne vide = un nouveau paragraphe. Ce fichier n\'est jamais publié en clair. -->\n\n');
}
const message = (await readFile(MESSAGE, 'utf8')).replace(/<!--[\s\S]*?-->/g, '').trim();

// --- 4. mot de passe ---
console.log(`${photos.length} photo(s) trouvée(s).`);
const mdp = await demander('Mot de passe : ');
if (normaliser(mdp).length < 3) { console.log('Mot de passe trop court.'); process.exit(1); }
if ((await demander('Encore une fois : ')) !== mdp) { console.log('Les deux mots de passe sont différents. Rien n\'a été changé.'); process.exit(1); }

// Si un site chiffré existe déjà, on vérifie que c'est le même mot de passe et on garde les identifiants
// des photos (les « Mes créations » enregistrées sur son téléphone continuent de marcher).
let anciensIds = {};
if (await existe(`${OUT}/manifest.bin`)) {
  const meta = JSON.parse(await readFile(`${OUT}/meta.json`, 'utf8'));
  try {
    const ancienne = await deriverCle(mdp, Buffer.from(meta.salt, 'base64'), meta.iterations);
    const ancien = JSON.parse(await dechiffrer(ancienne, await readFile(`${OUT}/manifest.bin`)));
    anciensIds = Object.fromEntries(ancien.photos.map((p) => [p.src, p.id]));
  } catch {
    const ok = await demander('Attention : ce n\'est PAS le même mot de passe que la dernière fois. Continuer quand même ? (o/N) ', false);
    if (!/^o/i.test(ok.trim())) { console.log('Rien n\'a été changé.'); process.exit(1); }
  }
}

const sel = randomBytes(16);
const cle = await deriverCle(mdp, sel, ITERATIONS);

// --- 5. photos : redimensionnées, sans métadonnées, chiffrées ---
const fichiers = new Map();
const utilises = new Set();
const manifeste = { version: 1, photos: [], message };
for (const [i, p] of photos.entries()) {
  process.stdout.write(`\r${i + 1}/${photos.length} ${p.src}`.padEnd(70));
  let entree = await readFile(`${SRC}/${p.src}`);
  if (/\.hei[cf]$/i.test(p.src)) entree = Buffer.from(await heicConvert({ buffer: entree, format: 'JPEG', quality: 0.95 }));
  // rotate() applique l'orientation EXIF ; sharp ne recopie aucune métadonnée (EXIF, GPS, ICC) sans withMetadata()
  const image = sharp(entree, { failOn: 'none' }).rotate();
  const grande = await image.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const mini = await image.clone().resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();

  let id = anciensIds[p.src];
  while (!id || utilises.has(id)) id = randomBytes(8).toString('hex');
  utilises.add(id);
  fichiers.set(`${id}.bin`, await chiffrer(cle, grande.data));
  fichiers.set(`${id}-m.bin`, await chiffrer(cle, mini));
  const { legende = '', date = '' } = legendes[p.src] ?? {};
  manifeste.photos.push({ id, src: p.src, cat: p.cat, w: grande.info.width, h: grande.info.height, legende, date });
}
fichiers.set('manifest.bin', await chiffrer(cle, Buffer.from(JSON.stringify(manifeste))));

// --- 6. écriture (on remplace tout : une photo retirée disparaît aussi du site) ---
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const [nom, contenu] of fichiers) await writeFile(`${OUT}/${nom}`, contenu);
const meta = { version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: sel.toString('base64'), cipher: 'AES-GCM-256' };
await writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 2) + '\n');

const n = (c) => manifeste.photos.filter((p) => p.cat === c).length;
console.log(`\n\nC'est fait ! ${n('nous')} photo(s) « Nous », ${n('mon-copain')} « Mon copain »${message ? ', et le mot de la fin' : ''}.`);
console.log('Étape suivante : git add -A, git commit -m "Photos", git push');
lignes && process.exit(0);
