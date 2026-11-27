import config from './config.json';
import { manifeste, morceau } from './data';
import { $, esc, enregistrerFichier } from './outils';

// Minuit le 25 décembre 2026, heure de Paris (UTC+1 en hiver). L'horloge de l'appareil fait foi.
const OUVERTURE = Date.parse('2026-12-25T00:00:00+01:00');

// Test en développement seulement : ?simuler=2026-12-25 (ce bloc disparaît du site publié).
let decalage = 0;
if (import.meta.env.DEV) {
  const sim = new URLSearchParams(location.search).get('simuler');
  if (sim) decalage = Date.parse(`${sim}T00:00:00+01:00`) - Date.now() || 0;
}
const maintenant = () => Date.now() + decalage;

const NOTE = '<svg viewBox="0 0 24 24"><path d="M9 3v11.4A3.6 3.6 0 1 0 11 17.6V8h6V3z"/></svg>';
const LIRE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

const notesFlottantes = () =>
  Array.from({ length: 10 }, (_, i) => {
    const style = `--x:${(i * 41) % 100}%;--taille:${14 + ((i * 7) % 14)}px;--duree:${12 + ((i * 5) % 10)}s;--delai:-${(i * 2.7) % 18}s`;
    return `<span class="coeur" style="${style}">${NOTE}</span>`;
  }).join('');

function clavier() {
  const blanches = Array.from({ length: 14 }, (_, i) => `<rect class="touche" style="--i:${i}" x="${i * 20}" width="19" height="90" rx="3"/>`);
  const noires = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => `<rect class="touche noire" style="--i:${i}" x="${i * 20 + 13}" width="12" height="56" rx="2"/>`);
  return `<svg class="clavier" viewBox="-2 -2 283 94" aria-hidden="true">${blanches.join('')}${noires.join('')}</svg>`;
}

const deux = (n: number) => String(n).padStart(2, '0');
const minutes = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${deux(Math.floor(s % 60))}` : '0:00');

export function afficherNoel(el: HTMLElement) {
  if (maintenant() >= OUVERTURE) return afficherOuvert(el);
  el.innerHTML = `
    <section class="scene-noel">
      <div class="coeurs" aria-hidden="true">${notesFlottantes()}</div>
      <h1 class="manuscrit">Le 25 décembre</h1>
      <p class="attente">${esc(config.noelAttente)}</p>
      <div class="rebours" role="timer" aria-label="Temps restant avant le 25 décembre">
        ${['jours', 'heures', 'minutes', 'secondes'].map((u) => `<div><span data-u="${u}">00</span><small>${u}</small></div>`).join('')}
      </div>
      ${clavier()}
    </section>`;
  const cases = [...el.querySelectorAll<HTMLElement>('[data-u]')];
  const tic = () => {
    const reste = OUVERTURE - maintenant();
    if (!el.isConnected || reste <= 0) {
      clearInterval(minuteur);
      if (el.isConnected) afficherOuvert(el);
      return;
    }
    const s = Math.floor(reste / 1000);
    [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].forEach((v, i) => (cases[i].textContent = deux(v)));
  };
  const minuteur = setInterval(tic, 1000);
  tic();
}

function afficherOuvert(el: HTMLElement) {
  const noel = manifeste?.noel;
  if (!noel) {
    el.innerHTML = `
      <section class="scene-noel ouvre">
        <h1 class="manuscrit">Joyeux Noël</h1>
        <p class="attente">${esc(config.noelBientot)}</p>
        ${clavier()}
      </section>`;
    return;
  }
  el.innerHTML = `
    <section class="scene-noel ouvre">
      <div class="coeurs" aria-hidden="true">${notesFlottantes()}</div>
      <h1 class="manuscrit">${esc(noel.titre || 'Joyeux Noël')}</h1>
      ${noel.dedicace ? `<p class="attente">${esc(noel.dedicace)}</p>` : ''}
      ${clavier()}
      <div class="lecteur">
        <button class="lire" type="button" aria-label="Lecture" disabled>${LIRE}</button>
        <input class="progres" type="range" min="0" max="0" step="0.1" value="0" aria-label="Position dans le morceau" disabled>
        <div class="temps"><span>0:00</span><span>0:00</span></div>
        <p class="statut-noel" role="status">Le morceau se prépare…</p>
        <button class="bouton clair telecharger" type="button" disabled>Télécharger le morceau</button>
      </div>
      <audio preload="auto"></audio>
    </section>`;

  const scene = $('.scene-noel', el);
  const audio = $<HTMLAudioElement>('audio', el);
  const lire = $<HTMLButtonElement>('.lire', el);
  const progres = $<HTMLInputElement>('.progres', el);
  const [ecoule, duree] = [...el.querySelectorAll('.temps span')];
  const statut = $('.statut-noel', el);
  const telecharger = $<HTMLButtonElement>('.telecharger', el);
  // Un <audio> retiré de la page continue de jouer : on l'arrête quand elle change de page.
  addEventListener('hashchange', () => audio.pause(), { once: true });

  let fichier: Blob;
  morceau(noel).then(
    (b) => {
      fichier = b;
      audio.src = URL.createObjectURL(b);
      lire.disabled = progres.disabled = telecharger.disabled = false;
      statut.textContent = '';
    },
    () => (statut.textContent = "Le morceau n'a pas pu se charger. Vérifie ta connexion, puis reviens sur cette page."),
  );

  const majDuree = () => {
    if (!Number.isFinite(audio.duration)) return;
    progres.max = String(audio.duration);
    duree.textContent = minutes(audio.duration);
  };
  audio.onloadedmetadata = audio.ondurationchange = majDuree;
  audio.ontimeupdate = () => {
    progres.value = String(audio.currentTime);
    ecoule.textContent = minutes(audio.currentTime);
  };
  audio.onplay = audio.onpause = () => {
    const joue = !audio.paused;
    scene.classList.toggle('joue', joue);
    lire.innerHTML = joue ? PAUSE : LIRE;
    lire.setAttribute('aria-label', joue ? 'Pause' : 'Lecture');
  };
  lire.onclick = () => (audio.paused ? audio.play().catch(() => (statut.textContent = 'Touche encore une fois le bouton lecture.')) : audio.pause());
  progres.oninput = () => (audio.currentTime = Number(progres.value));
  telecharger.onclick = () => enregistrerFichier(fichier, noel.nom);
}
