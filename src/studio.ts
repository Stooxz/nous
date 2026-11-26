import config from './config.json';
import { NOMS, photo, photosDe, type Categorie } from './data';
import { $, enregistrerFichier, esc } from './outils';
import { CADRES, COEUR, ETOILE, FILTRES, FORMATS, dessiner, gabarit, nbCases, placement, preparerPolices, type Reglages } from './rendu';
import { garder, imagesDe } from './creations';
import { altPhoto, chargerAuDefilement } from './galerie';

const MAX = 4;
const EXPORT = 2.4; // pixels par 0,1 mm ≈ 600 dpi
let brouillon: { id?: number; reglages: Reglages } | null = null;

const recadragesNeufs = () => Array.from({ length: MAX }, () => ({ x: 0, y: 0, zoom: 1 }));
const formatPour = (n: number) => (n >= 4 ? 'bande4' : n === 3 ? 'bande3' : n === 2 ? 'grille' : 'polaroid');

function reglagesPour(ids: string[]): Reglages {
  return { format: formatPour(ids.length), photos: ids, recadrages: recadragesNeufs(), cadre: 'creme', filtre: 'aucun', texte: config.texteBande, police: 'manuscrite', deco: 'coeurs' };
}

export function nouvelleBande(ids: string[]) {
  brouillon = { reglages: reglagesPour(ids) };
  location.hash = '#studio';
}
export function ouvrirCreation(id: number, reglages: Reglages) {
  brouillon = { id, reglages: structuredClone(reglages) };
  location.hash = '#studio';
}

const svg = (d: string) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}"/></svg>`;
const choix = (nom: string, legende: string, options: [string, string, string?][], actuel: string) => `
  <fieldset class="choix choix-${nom}"><legend>${legende}</legend>
    ${options.map(([v, l, extra = '']) => `<label class="pastille"><input type="radio" name="${nom}" value="${v}" ${v === actuel ? 'checked' : ''}><span>${extra}<span class="nom">${l}</span></span></label>`).join('')}
  </fieldset>`;

const ONGLETS = [
  ['photos', 'Photos'],
  ['format', 'Format'],
  ['style', 'Style'],
  ['texte', 'Texte'],
  ['enregistrer', 'Enregistrer'],
];

export async function afficherStudio(el: HTMLElement) {
  brouillon ??= { reglages: reglagesPour(photosDe('nous').slice(0, MAX).map((p) => p.id)) };
  const b = brouillon;
  const r = b.reglages;
  let active = 0;
  let pdf = 'reel';

  el.innerHTML = `
    <h1 class="sr-only">Studio photomaton</h1>
    <div class="scene"><canvas id="apercu" role="img" aria-label="Aperçu de la création"></canvas></div>
    <div class="cadrage">
      <label for="zoom">Zoom <span id="num-case"></span></label>
      <input type="range" id="zoom" min="1" max="3" step="0.01">
      <button class="bouton secondaire petit" id="recentrer">Recentrer</button>
    </div>
    <div class="onglets onglets-studio" role="tablist" aria-label="Réglages du studio">
      ${ONGLETS.map(([id, nom], i) => `<button role="tab" id="o-${id}" aria-controls="p-${id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${nom}</button>`).join('')}
    </div>
    <div class="panneaux">
      <section role="tabpanel" id="p-photos" aria-labelledby="o-photos">
        <p class="discret">Touche une photo pour la mettre en premier.</p>
        <div class="vignettes"></div>
        <button class="bouton secondaire" id="changer">Changer les photos</button>
      </section>
      <section role="tabpanel" id="p-format" aria-labelledby="o-format" hidden>
        ${choix('format', 'Format', FORMATS, r.format)}
      </section>
      <section role="tabpanel" id="p-style" aria-labelledby="o-style" hidden>
        ${choix('cadre', 'Couleur du cadre', CADRES.map((c) => [c.id, c.nom, `<i class="teinte" style="background:${c.fond}"></i>`]), r.cadre)}
        ${choix('filtre', 'Filtre', FILTRES, r.filtre)}
      </section>
      <section role="tabpanel" id="p-texte" aria-labelledby="o-texte" hidden>
        <label for="texte">Texte en bas (2 lignes au plus)</label>
        <textarea id="texte" rows="2" maxlength="60"></textarea>
        ${choix('police', 'Police', [['manuscrite', 'Manuscrite'], ['elegante', 'Élégante']], r.police)}
        ${choix('deco', 'Décorations', [['aucune', 'Aucune'], ['coeurs', 'Cœurs', svg(COEUR)], ['etoiles', 'Étoiles', svg(ETOILE)]], r.deco)}
      </section>
      <section role="tabpanel" id="p-enregistrer" aria-labelledby="o-enregistrer" hidden>
        ${choix('pdf', 'Taille du PDF', [['reel', 'Taille réelle'], ['a4', 'Centré sur A4']], pdf)}
        <div class="actions">
          <button class="bouton principal" id="en-pdf">Enregistrer en PDF</button>
          <button class="bouton principal" id="en-png">Enregistrer en image</button>
          <button class="bouton secondaire" id="imprimer">Imprimer</button>
          <button class="bouton secondaire" id="garder">Garder dans Mes créations</button>
        </div>
        <p class="statut" role="status" aria-live="polite"></p>
      </section>
    </div>`;

  const scene = $('.scene', el);
  const canvas = $<HTMLCanvasElement>('#apercu', el);
  const zoom = $<HTMLInputElement>('#zoom', el);
  const statut = $('.statut', el);
  const texte = $<HTMLTextAreaElement>('#texte', el);
  texte.value = r.texte;

  let images: (HTMLImageElement | undefined)[] = [];
  let echelle = 1;
  let prevu = 0;

  // --- aperçu en direct ---
  const peindre = () => {
    prevu = 0;
    const g = gabarit(r.format);
    const place = Math.min(scene.clientWidth / g.W, scene.clientHeight / g.H);
    if (!(place > 0)) return; // vue cachée ou en cours de changement
    echelle = place * devicePixelRatio;
    dessiner(canvas, r, images, echelle, nbCases(r.format) > 1 ? active : -1);
    canvas.style.width = `${g.W * place}px`;
    canvas.style.height = `${g.H * place}px`;
  };
  const redessiner = () => (prevu ||= requestAnimationFrame(peindre));
  const majCadrage = () => {
    active = Math.min(active, nbCases(r.format) - 1);
    zoom.value = String(r.recadrages[active].zoom);
    $('#num-case', el).textContent = nbCases(r.format) > 1 ? `de la case ${active + 1}` : 'de la photo';
  };
  const charger = async () => {
    images = await imagesDe(r);
    redessiner();
  };
  new ResizeObserver(redessiner).observe(scene);

  const vignettes = () => {
    $('.vignettes', el).innerHTML = r.photos
      .map((id, i) => {
        const p = photo(id);
        return `<button class="vignette" data-i="${i}" aria-label="${p ? esc(altPhoto(p)) : 'Photo retirée'}${i ? ', mettre en premier' : ', en premier'}"><img data-id="${id}" alt=""><span>${i + 1}</span></button>`;
      })
      .join('');
    chargerAuDefilement($('.vignettes', el));
  };

  // --- onglets ---
  const onglets = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
  const montrer = (i: number) => {
    onglets.forEach((o, j) => {
      o.setAttribute('aria-selected', String(i === j));
      o.tabIndex = i === j ? 0 : -1;
      $(`#${o.getAttribute('aria-controls')}`, el).hidden = i !== j;
    });
  };
  onglets.forEach((o, i) => {
    o.onclick = () => montrer(i);
    o.onkeydown = (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const j = (i + d + onglets.length) % onglets.length;
      montrer(j);
      onglets[j].focus();
    };
  });

  // --- réglages ---
  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'pdf') return void (pdf = t.value);
    if (t.type !== 'radio') return;
    (r as Record<string, unknown>)[t.name] = t.value;
    if (t.name === 'format') majCadrage();
    redessiner();
  });
  texte.oninput = () => {
    r.texte = texte.value.split('\n').slice(0, 2).join('\n');
    redessiner();
  };
  $('.vignettes', el).onclick = (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('.vignette');
    if (!v || v.dataset.i === '0') return;
    const [id] = r.photos.splice(Number(v.dataset.i), 1);
    r.photos.unshift(id);
    r.recadrages = recadragesNeufs();
    vignettes();
    charger();
  };
  $('#changer', el).onclick = async () => {
    const ids = await choisirPhotos(r.photos);
    if (!ids) return;
    if (ids.length !== r.photos.length) {
      r.format = formatPour(ids.length);
      el.querySelector<HTMLInputElement>(`[name=format][value=${r.format}]`)!.checked = true;
    }
    r.photos = ids;
    r.recadrages = recadragesNeufs();
    majCadrage();
    vignettes();
    charger();
  };
  zoom.oninput = () => {
    r.recadrages[active].zoom = Number(zoom.value);
    redessiner();
  };
  $('#recentrer', el).onclick = () => {
    r.recadrages[active] = { x: 0, y: 0, zoom: 1 };
    majCadrage();
    redessiner();
  };

  // --- recadrage au doigt : toucher choisit la case, glisser centre, pincer zoome ---
  const doigts = new Map<number, { x: number; y: number }>();
  let pince: { zoom: number; dist: number } | null = null;
  const enUnites = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    const k = gabarit(r.format).W / b.width;
    return { x: (e.clientX - b.left) * k, y: (e.clientY - b.top) * k };
  };
  const ecart = () => {
    const [a, c] = [...doigts.values()];
    return Math.hypot(a.x - c.x, a.y - c.y) || 1;
  };
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = enUnites(e);
    doigts.set(e.pointerId, p);
    if (doigts.size === 1) {
      const i = gabarit(r.format).cases.findIndex((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (i >= 0 && i !== active) {
        active = i;
        majCadrage();
        redessiner();
      }
    } else if (doigts.size === 2) pince = { zoom: r.recadrages[active].zoom, dist: ecart() };
  };
  canvas.onpointermove = (e) => {
    const avant = doigts.get(e.pointerId);
    if (!avant) return;
    const p = enUnites(e);
    doigts.set(e.pointerId, p);
    const rec = r.recadrages[active];
    if (pince && doigts.size === 2) {
      rec.zoom = Math.min(3, Math.max(1, (pince.zoom * ecart()) / pince.dist));
      zoom.value = String(rec.zoom);
    } else if (doigts.size === 1) {
      const img = images[active % r.photos.length];
      if (!img) return;
      const c = gabarit(r.format).cases[active];
      const pl = placement({ width: img.naturalWidth, height: img.naturalHeight }, c, rec);
      const dep = (v: number, d: number, trop: number) => (trop > 0.5 ? Math.min(1, Math.max(-1, v - (2 * d) / trop)) : v);
      rec.x = dep(rec.x, p.x - avant.x, pl.w - c.w);
      rec.y = dep(rec.y, p.y - avant.y, pl.h - c.h);
    }
    redessiner();
  };
  canvas.onpointerup = canvas.onpointercancel = (e) => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) pince = null;
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    const rec = r.recadrages[active];
    rec.zoom = Math.min(3, Math.max(1, rec.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    zoom.value = String(rec.zoom);
    redessiner();
  };

  // --- exports (rendu haute résolution, sans le pointillé de sélection) ---
  const enGrand = () => {
    const c = document.createElement('canvas');
    dessiner(c, r, images, EXPORT);
    return c;
  };
  const versBlob = (c: HTMLCanvasElement, type: string) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('canvas'))), type, 0.95));
  const nomFichier = (ext: string) => `nous-${r.format}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const sauver = async () => {
    b.id = await garder({ id: b.id, maj: Date.now(), reglages: structuredClone(r) });
  };
  const action = (id: string, enCours: string, fait: string, f: () => Promise<unknown>) => {
    const bouton = $<HTMLButtonElement>(id, el);
    bouton.onclick = async () => {
      bouton.disabled = true;
      statut.textContent = enCours;
      try {
        await f();
        await sauver().catch(() => {});
        statut.textContent = fait;
      } catch (e) {
        console.error(e);
        statut.textContent = 'Oups, ça n\'a pas marché. Réessaie ?';
      }
      bouton.disabled = false;
    };
  };

  action('#en-png', 'Préparation de l\'image…', 'Image prête ! (aussi gardée dans Mes créations)', async () => {
    await enregistrerFichier(await versBlob(enGrand(), 'image/png'), nomFichier('png'));
  });
  action('#en-pdf', 'Préparation du PDF…', 'PDF prêt ! (aussi gardé dans Mes créations)', async () => {
    const { jsPDF } = await import('jspdf');
    const g = gabarit(r.format);
    const [w, h] = [g.W / 10, g.H / 10]; // en mm
    const reel = pdf === 'reel';
    const doc = new jsPDF({ unit: 'mm', format: reel ? [w, h] : 'a4', orientation: 'portrait' });
    doc.addImage(enGrand().toDataURL('image/jpeg', 0.95), 'JPEG', reel ? 0 : (210 - w) / 2, reel ? 0 : (297 - h) / 2, w, h);
    await enregistrerFichier(doc.output('blob'), nomFichier('pdf'));
  });
  action('#imprimer', 'Préparation de l\'impression…', 'Gardée dans Mes créations.', async () => {
    const g = gabarit(r.format);
    const zone = $('#impression');
    URL.revokeObjectURL(zone.querySelector('img')?.src ?? '');
    const img = new Image();
    img.src = URL.createObjectURL(await versBlob(enGrand(), 'image/jpeg'));
    img.style.cssText = `width:${g.W / 10}mm;height:${g.H / 10}mm`;
    await img.decode();
    zone.replaceChildren(img);
    print();
  });
  action('#garder', 'Un instant…', 'Gardée dans Mes créations.', async () => {});

  majCadrage();
  vignettes();
  await preparerPolices();
  charger();
}

/** Fenêtre de choix de 1 à 4 photos, dans les deux catégories. */
function choisirPhotos(actuelles: string[]): Promise<string[] | null> {
  const choisies = [...actuelles];
  const d = document.createElement('dialog');
  d.className = 'choisir';
  d.setAttribute('aria-labelledby', 'titre-choisir');
  d.innerHTML = `
    <h2 id="titre-choisir" class="manuscrit">Choisis 1 à ${MAX} photos</h2>
    ${(['nous', 'mon-copain'] as Categorie[])
      .map((c) => `<h3>${NOMS[c]}</h3><div class="mini-grille">${photosDe(c).map((p) => `<button class="tuile" data-id="${p.id}" aria-pressed="${choisies.includes(p.id)}"><img data-id="${p.id}" alt="${esc(altPhoto(p))}"></button>`).join('')}</div>`)
      .join('')}
    <div class="pied"><span role="status" aria-live="polite"></span>
      <button class="bouton secondaire" value="annuler">Annuler</button>
      <button class="bouton principal" value="ok">Valider</button></div>`;
  document.body.append(d);
  d.showModal();
  chargerAuDefilement(d);
  const statut = $('[role=status]', d);
  const valider = $<HTMLButtonElement>('[value=ok]', d);
  const maj = () => {
    d.querySelectorAll<HTMLElement>('.tuile').forEach((t) => t.setAttribute('aria-pressed', String(choisies.includes(t.dataset.id!))));
    statut.textContent = `${choisies.length} / ${MAX}`;
    valider.disabled = !choisies.length;
  };
  maj();
  return new Promise((fini) => {
    d.onclick = (e) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!t) return;
      if (t.value) return d.close(t.value);
      const id = t.dataset.id!;
      const i = choisies.indexOf(id);
      if (i >= 0) choisies.splice(i, 1);
      else if (choisies.length < MAX) choisies.push(id);
      else return void (statut.textContent = `${MAX} au maximum`);
      maj();
    };
    d.onclose = () => {
      d.remove();
      fini(d.returnValue === 'ok' ? choisies : null);
    };
  });
}

