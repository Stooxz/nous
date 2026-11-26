import { imagePhoto } from './data';
import { $, esc } from './outils';
import { dessiner, FORMATS, gabarit, type Reglages } from './rendu';
import { ouvrirCreation } from './studio';

// « Mes créations » : seulement les réglages et les identifiants des photos, jamais les images.
export type Creation = { id?: number; maj: number; reglages: Reglages };

function magasin<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((ok, ko) => {
    const ouverture = indexedDB.open('nous', 1);
    ouverture.onupgradeneeded = () => ouverture.result.createObjectStore('creations', { keyPath: 'id', autoIncrement: true });
    ouverture.onerror = () => ko(ouverture.error);
    ouverture.onsuccess = () => {
      const req = action(ouverture.result.transaction('creations', mode).objectStore('creations'));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
    };
  });
}

export const garder = (c: Creation) => {
  if (c.id === undefined) delete c.id; // laisse IndexedDB choisir le numéro
  return magasin('readwrite', (s) => s.put(c)) as Promise<number>;
};
const lister = () => magasin<Creation[]>('readonly', (s) => s.getAll());
const supprimer = (id: number) => magasin('readwrite', (s) => s.delete(id));

export const imagesDe = (r: Reglages) => Promise.all(r.photos.map((id) => imagePhoto(id).catch(() => undefined)));

export async function afficherCreations(el: HTMLElement) {
  el.innerHTML = `<header class="entete"><h1 class="manuscrit">Mes créations</h1></header><ul class="creations"></ul>`;
  const liste = $('.creations', el);
  const toutes = (await lister().catch(() => [])).sort((a, b) => b.maj - a.maj);
  if (!toutes.length) {
    liste.outerHTML = `<p class="vide">Pas encore de création. Choisis des photos et passe au <a href="#studio">studio</a> !</p>`;
    return;
  }
  for (const c of toutes) {
    const nom = FORMATS.find(([f]) => f === c.reglages.format)?.[1] ?? '';
    const date = new Date(c.maj).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const li = document.createElement('li');
    li.className = 'creation';
    li.innerHTML = `
      <canvas role="img" aria-label="${nom}${c.reglages.texte ? ` : ${esc(c.reglages.texte)}` : ''}"></canvas>
      <div><p><strong>${nom}</strong><br><span class="discret">${date}</span></p>
      <div class="actions"><button class="bouton principal ouvrir">Modifier</button><button class="bouton secondaire supprimer">Supprimer</button></div></div>`;
    liste.append(li);
    $('.ouvrir', li).onclick = () => ouvrirCreation(c.id!, c.reglages);
    $('.supprimer', li).onclick = async () => {
      if (!confirm('Supprimer cette création ? (les photos, elles, restent)')) return;
      await supprimer(c.id!);
      li.remove();
      if (!liste.children.length) afficherCreations(el);
    };
    imagesDe(c.reglages).then((imgs) => dessiner($<HTMLCanvasElement>('canvas', li), c.reglages, imgs, (220 * devicePixelRatio) / gabarit(c.reglages.format).H));
  }
}
