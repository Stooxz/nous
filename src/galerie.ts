import { NOMS, photosDe, urlPhoto, type Categorie, type Photo } from './data';
import { $, esc } from './outils';
import { nouvelleBande } from './studio';

const CATEGORIES: Categorie[] = ['nous', 'mon-copain'];
const MAX = 4;
let onglet: Categorie = 'nous';
let enSelection = false;
const choisies: string[] = [];

export const altPhoto = (p: Photo) => `Photo de la catégorie ${NOMS[p.cat]}${p.legende ? ` : ${p.legende}` : ''}`;

/** Charge les miniatures quand elles approchent de l'écran (chargement progressif). */
export function chargerAuDefilement(racine: HTMLElement) {
  const obs = new IntersectionObserver(
    (entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        const img = e.target as HTMLImageElement;
        img.onload = () => img.classList.add('chargee');
        urlPhoto(img.dataset.id!, true).then((u) => (img.src = u));
      }
    },
    { rootMargin: '400px' },
  );
  racine.querySelectorAll('img[data-id]').forEach((i) => obs.observe(i));
}

export function afficherGalerie(el: HTMLElement) {
  el.innerHTML = `
    <header class="entete">
      <h1 class="manuscrit">Nos souvenirs</h1>
      <div class="onglets" role="tablist" aria-label="Catégories">
        ${CATEGORIES.map((c) => `<button role="tab" id="onglet-${c}" data-cat="${c}" aria-controls="mosaique">${NOMS[c]} <span class="compte">${photosDe(c).length}</span></button>`).join('')}
      </div>
    </header>
    <div class="outils-galerie">
      <button class="bouton secondaire" id="choisir" aria-pressed="false">Choisir pour le studio</button>
    </div>
    <p class="aide-selection">Touche jusqu'à ${MAX} photos (les deux onglets se mélangent), puis « Créer une bande ».</p>
    <div id="mosaique" class="mosaique" role="tabpanel"></div>
    <div class="barre-selection">
      <span role="status" aria-live="polite"></span>
      <button class="bouton principal" id="vers-studio">Créer une bande</button>
    </div>`;

  const mosaique = $('#mosaique', el);
  const choisir = $('#choisir', el);
  const statut = $('.barre-selection [role=status]', el);
  const versStudio = $<HTMLButtonElement>('#vers-studio', el);

  const majSelection = () => {
    el.classList.toggle('en-selection', enSelection);
    choisir.setAttribute('aria-pressed', String(enSelection));
    choisir.textContent = enSelection ? 'Annuler' : 'Choisir pour le studio';
    statut.textContent = `${choisies.length} / ${MAX} photo${choisies.length > 1 ? 's' : ''}`;
    versStudio.disabled = choisies.length === 0;
    mosaique.querySelectorAll<HTMLElement>('.tuile').forEach((t) => {
      if (enSelection) t.setAttribute('aria-pressed', String(choisies.includes(t.dataset.id!)));
      else t.removeAttribute('aria-pressed');
    });
  };

  const montrer = (cat: Categorie) => {
    onglet = cat;
    el.querySelectorAll<HTMLElement>('[role=tab]').forEach((t) => {
      const actif = t.dataset.cat === cat;
      t.setAttribute('aria-selected', String(actif));
      t.tabIndex = actif ? 0 : -1;
    });
    mosaique.setAttribute('aria-labelledby', `onglet-${cat}`);
    const liste = photosDe(cat);
    mosaique.innerHTML = liste.length
      ? liste.map((p) => `<button class="tuile" data-id="${p.id}" style="aspect-ratio:${p.w}/${p.h}"><img data-id="${p.id}" alt="${esc(altPhoto(p))}"></button>`).join('')
      : '<p class="vide">Pas encore de photo ici.</p>';
    chargerAuDefilement(mosaique);
    majSelection();
  };

  el.querySelector('[role=tablist]')!.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[role=tab]');
    if (t) montrer(t.dataset.cat as Categorie);
  });
  el.querySelector('[role=tablist]')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    const autre = CATEGORIES[(CATEGORIES.indexOf(onglet) + 1) % 2];
    montrer(autre);
    $<HTMLElement>(`#onglet-${autre}`, el).focus();
  });

  choisir.onclick = () => {
    enSelection = !enSelection;
    if (!enSelection) choisies.length = 0;
    majSelection();
  };
  versStudio.onclick = () => {
    const ids = [...choisies];
    choisies.length = 0;
    enSelection = false;
    nouvelleBande(ids);
  };

  mosaique.onclick = (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.tuile');
    if (!t) return;
    const id = t.dataset.id!;
    if (!enSelection) return ouvrirVisionneuse(photosDe(onglet), id, t);
    const i = choisies.indexOf(id);
    if (i >= 0) choisies.splice(i, 1);
    else if (choisies.length < MAX) choisies.push(id);
    else return void (statut.textContent = `${MAX} photos au maximum : enlève-en une d'abord.`);
    majSelection();
  };

  montrer(onglet);
}

const FLECHE = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

function ouvrirVisionneuse(liste: Photo[], id: string, retour: HTMLElement) {
  const d = document.createElement('dialog');
  d.className = 'visionneuse';
  d.setAttribute('aria-label', 'Visionneuse de photos');
  d.innerHTML = `
    <div class="piste"><img alt=""></div>
    <p class="legende" aria-live="polite"></p>
    <button class="rond fermer" aria-label="Fermer">${FLECHE('M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z')}</button>
    <button class="rond prec" aria-label="Photo précédente">${FLECHE('M15.4 4 7.4 12l8 8 1.4-1.4L10.2 12l6.6-6.6z')}</button>
    <button class="rond suiv" aria-label="Photo suivante">${FLECHE('m8.6 4 8 8-8 8-1.4-1.4 6.6-6.6-6.6-6.6z')}</button>`;
  document.body.append(d);
  d.showModal();
  document.body.classList.add('fige');

  const img = $<HTMLImageElement>('img', d);
  const legende = $('.legende', d);
  let i = liste.findIndex((p) => p.id === id);

  const afficher = async (sens = 0) => {
    const p = liste[i];
    img.alt = altPhoto(p);
    legende.textContent = [p.legende, p.date, `${i + 1} / ${liste.length}`].filter(Boolean).join(' · ');
    img.style.transition = 'none';
    img.style.transform = `translateX(${sens * 40}%)`;
    img.style.opacity = sens ? '0' : '1';
    img.src = await urlPhoto(p.id, true); // la miniature d'abord, tout de suite
    requestAnimationFrame(() => {
      img.style.transition = '';
      img.style.transform = '';
      img.style.opacity = '1';
    });
    const grande = await urlPhoto(p.id);
    if (liste[i] === p) img.src = grande;
    [liste[i + 1], liste[i - 1]].forEach((v) => v && urlPhoto(v.id)); // précharge les voisines
  };
  const aller = (sens: number) => {
    if (!liste[i + sens]) return afficher(0);
    i += sens;
    afficher(sens);
  };

  // Balayage au doigt
  const piste = $('.piste', d);
  let x0: number | null = null;
  piste.onpointerdown = (e) => {
    x0 = e.clientX;
    piste.setPointerCapture(e.pointerId);
    img.style.transition = 'none';
  };
  piste.onpointermove = (e) => {
    if (x0 !== null) img.style.transform = `translateX(${e.clientX - x0}px)`;
  };
  piste.onpointerup = piste.onpointercancel = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    img.style.transition = '';
    if (Math.abs(dx) > 50) aller(dx < 0 ? 1 : -1);
    else img.style.transform = '';
  };

  $('.prec', d).onclick = () => aller(-1);
  $('.suiv', d).onclick = () => aller(1);
  $('.fermer', d).onclick = () => d.close();
  d.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') aller(-1);
    if (e.key === 'ArrowRight') aller(1);
  };
  d.onclose = () => {
    d.remove();
    document.body.classList.remove('fige');
    retour.focus();
  };
  afficher();
}
