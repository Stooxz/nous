import '@fontsource/dancing-script/600.css';
import '@fontsource/playfair-display/500-italic.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './style.css';
import { estOuvert, manifeste } from './data';
import { $ } from './outils';
import { afficherAccueil } from './accueil';
import { afficherGalerie } from './galerie';
import { afficherStudio } from './studio';
import { afficherCreations } from './creations';
import { afficherNoel } from './noel';

const icone = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const VUES = {
  galerie: { nom: 'Photos', icone: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', afficher: afficherGalerie },
  studio: { nom: 'Studio', icone: 'M8 2h8v20H8zM10 4v4h4V4zm0 6v4h4v-4zm0 6v4h4v-4z', afficher: afficherStudio },
  creations: { nom: 'Créations', icone: 'M12 21C6 16.5 2.5 13 2.5 8.8 2.5 5.9 4.8 3.6 7.6 3.6c1.8 0 3.4.9 4.4 2.4 1-1.5 2.6-2.4 4.4-2.4 2.8 0 5.1 2.3 5.1 5.2 0 4.2-3.5 7.7-9.5 12.2z', afficher: afficherCreations },
  noel: { nom: 'Noël', icone: 'M9 3v11.4A3.6 3.6 0 1 0 11 17.6V8h6V3z', afficher: afficherNoel },
  mot: { nom: 'Le mot', icone: 'M3 5h18v14H3zm2 2v.5l7 5 7-5V7l-7 5z', afficher: afficherMot },
} as const;
type Vue = keyof typeof VUES;

const app = $('#app');

function router() {
  if (!estOuvert()) return afficherAccueil(app, router);
  let vue = location.hash.replace(/^#\/?/, '') as Vue; // #noel ou #/noel
  if (!(vue in VUES) || (vue === 'mot' && !manifeste?.message)) vue = 'galerie';
  const liens = (Object.keys(VUES) as Vue[])
    .filter((v) => v !== 'mot' || manifeste?.message)
    .map((v) => `<a href="#${v}" ${v === vue ? 'aria-current="page"' : ''}>${icone(VUES[v].icone)}<span>${VUES[v].nom}</span></a>`)
    .join('');
  app.innerHTML = `<main id="contenu" class="vue vue-${vue}"></main><nav class="menu" aria-label="Menu">${liens}</nav>`;
  scrollTo(0, 0);
  VUES[vue].afficher($('#contenu'));
}

function afficherMot(el: HTMLElement) {
  el.innerHTML = `<article class="mot"><h1 class="manuscrit">Le mot de la fin</h1><div class="lettre"></div></article>`;
  const lettre = $('.lettre', el);
  for (const para of manifeste!.message.split(/\n\s*\n/)) lettre.append(Object.assign(document.createElement('p'), { textContent: para.trim() }));
}

addEventListener('hashchange', router);
router();
