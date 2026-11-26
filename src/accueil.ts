import config from './config.json';
import { ouvrir } from './data';
import { esc, $ } from './outils';

const COEUR = '<svg viewBox="0 0 100 100"><path d="M50 88C26 70 6 54 6 33 6 18 17 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 25 0 21-20 37-44 55z"/></svg>';
const OEIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.6 1.5 12c1.2 2.4 5 7 10.5 7s9.3-4.6 10.5-7C21.3 9.6 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>';

const coeursFlottants = () =>
  Array.from({ length: 14 }, (_, i) => {
    const style = `--x:${(i * 37) % 100}%;--taille:${10 + ((i * 7) % 18)}px;--duree:${14 + ((i * 5) % 12)}s;--delai:-${(i * 3.1) % 20}s`;
    return `<span class="coeur" style="${style}">${COEUR}</span>`;
  }).join('');

let essais = 0;

export function afficherAccueil(app: HTMLElement, entrer: () => void) {
  app.innerHTML = `
    <main class="accueil">
      <div class="coeurs" aria-hidden="true">${coeursFlottants()}</div>
      <form class="porte" novalidate>
        <h1 class="manuscrit">${esc(config.phraseAccueil)}</h1>
        <p class="sous-titre">${esc(config.sousTitre)}</p>
        <label for="mdp">Mot de passe</label>
        <div class="champ">
          <input id="mdp" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go">
          <button type="button" class="voir" aria-pressed="false" aria-label="Afficher le mot de passe">${OEIL}</button>
        </div>
        ${config.indice ? `<p class="indice">Indice : ${esc(config.indice)}</p>` : ''}
        <button class="bouton clair" type="submit">Entrer</button>
        <p class="message" role="status" aria-live="polite"></p>
      </form>
      <div class="grand-coeur" aria-hidden="true">${COEUR}</div>
    </main>`;

  const form = $<HTMLFormElement>('.porte', app);
  const champ = $<HTMLInputElement>('#mdp', app);
  const bouton = $<HTMLButtonElement>('[type=submit]', form);
  const message = $('.message', form);
  const voir = $('.voir', form);

  voir.onclick = () => {
    const visible = champ.type === 'password';
    champ.type = visible ? 'text' : 'password';
    voir.setAttribute('aria-pressed', String(visible));
    voir.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!champ.value.trim()) return champ.focus();
    bouton.disabled = true;
    bouton.textContent = 'Un instant…';
    message.textContent = '';
    let ok = false;
    try {
      ok = await ouvrir(champ.value);
    } catch {
      message.textContent = "Le site n'arrive pas à se charger. Vérifie ta connexion et réessaie.";
    }
    bouton.disabled = false;
    bouton.textContent = 'Entrer';
    if (ok) {
      const main = $('.accueil', app);
      main.classList.add('ouverture');
      const lent = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(entrer, lent ? 1100 : 200);
      return;
    }
    if (message.textContent) return;
    essais++;
    message.textContent = essais >= 3 ? config.apresTroisEssais : config.erreurs[(essais - 1) % config.erreurs.length];
    form.classList.remove('secoue');
    void form.offsetWidth; // relance l'animation
    form.classList.add('secoue');
    champ.select();
  };
  champ.focus();
}
