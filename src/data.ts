import { normaliser } from './motdepasse.js';

export type Categorie = 'nous' | 'mon-copain';
export type Photo = { id: string; cat: Categorie; w: number; h: number; legende: string; date: string };
type Manifeste = { version: number; photos: Photo[]; message: string };

const DOSSIER = import.meta.env.BASE_URL + 'data/';
export const NOMS: Record<Categorie, string> = { nous: 'Nous', 'mon-copain': 'Mon copain' };

// La clé dérivée ne vit qu'en mémoire, le temps de la visite : jamais le mot de passe, jamais dans localStorage.
let cle: CryptoKey | null = null;
export let manifeste: Manifeste | null = null;

async function lire(nom: string) {
  const r = await fetch(DOSSIER + nom);
  if (!r.ok) throw new Error(`${nom} : ${r.status}`);
  return r.arrayBuffer();
}

// Format partagé avec scripts/encrypt.mjs : 12 octets d'IV puis le texte chiffré AES-GCM (étiquette incluse).
const dechiffrer = (k: CryptoKey, buf: ArrayBuffer) =>
  crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12));

/** Vrai si le mot de passe déchiffre le manifeste : c'est la seule « vérification » qui existe. */
export async function ouvrir(motDePasse: string): Promise<boolean> {
  const meta = JSON.parse(new TextDecoder().decode(await lire('meta.json')));
  const sel = Uint8Array.from(atob(meta.salt), (c) => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normaliser(motDePasse)), 'PBKDF2', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: meta.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const chiffre = await lire('manifest.bin');
  try {
    manifeste = JSON.parse(new TextDecoder().decode(await dechiffrer(k, chiffre)));
  } catch {
    return false;
  }
  cle = k;
  return true;
}

export const estOuvert = () => cle !== null;
export const photo = (id: string) => manifeste?.photos.find((p) => p.id === id);
export const photosDe = (cat: Categorie) => manifeste?.photos.filter((p) => p.cat === cat) ?? [];

const urls = new Map<string, Promise<string>>();
/** URL locale (blob:) d'une photo déchiffrée à la volée ; mini = version légère pour la grille. */
export function urlPhoto(id: string, mini = false): Promise<string> {
  const nom = mini ? `${id}-m.bin` : `${id}.bin`;
  let u = urls.get(nom);
  if (!u) {
    u = lire(nom).then((b) => dechiffrer(cle!, b)).then((d) => URL.createObjectURL(new Blob([d], { type: 'image/jpeg' })));
    u.catch(() => urls.delete(nom));
    urls.set(nom, u);
  }
  return u;
}

const images = new Map<string, Promise<HTMLImageElement>>();
/** Image pleine résolution prête pour le canvas du studio. */
export function imagePhoto(id: string): Promise<HTMLImageElement> {
  let p = images.get(id);
  if (!p) {
    p = urlPhoto(id).then((u) => {
      const img = new Image();
      img.src = u;
      return img.decode().then(() => img);
    });
    p.catch(() => images.delete(id));
    images.set(id, p);
  }
  return p;
}
