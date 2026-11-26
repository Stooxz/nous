// Dessin d'une création sur un canvas. Les dimensions sont en dixièmes de millimètre :
// une bande fait 500 × 1500, soit 5 × 15 cm comme un vrai photomaton.

export type Format = 'bande3' | 'bande4' | 'grille' | 'polaroid';
export type Filtre = 'aucun' | 'nb' | 'sepia' | 'chaud' | 'vintage';
export type Recadrage = { x: number; y: number; zoom: number };
export type Reglages = {
  format: Format;
  photos: string[];
  recadrages: Recadrage[];
  cadre: string;
  filtre: Filtre;
  texte: string;
  police: 'manuscrite' | 'elegante';
  deco: 'aucune' | 'coeurs' | 'etoiles';
};
type Rect = { x: number; y: number; w: number; h: number };

export const FORMATS: [Format, string][] = [
  ['bande3', 'Bande de 3'],
  ['bande4', 'Bande de 4'],
  ['grille', 'Grille 2 × 2'],
  ['polaroid', 'Polaroïd'],
];
export const FILTRES: [Filtre, string][] = [
  ['aucun', 'Aucun'],
  ['nb', 'Noir et blanc'],
  ['sepia', 'Sépia'],
  ['chaud', 'Chaud'],
  ['vintage', 'Vintage'],
];
export const CADRES = [
  { id: 'creme', nom: 'Crème', fond: '#fbf5ec', encre: '#6e1f33' },
  { id: 'rose', nom: 'Rose poudré', fond: '#f2cfd4', encre: '#6e1f33' },
  { id: 'bordeaux', nom: 'Bordeaux', fond: '#6e1f33', encre: '#fbf0ec' },
  { id: 'sauge', nom: 'Sauge', fond: '#b9c8b3', encre: '#2f3d2c' },
  { id: 'nuit', nom: 'Bleu nuit', fond: '#1f2a44', encre: '#f3e6d8' },
  { id: 'noir', nom: 'Noir', fond: '#151313', encre: '#f5efe6' },
];

// Décorations dessinées à la main, dans une boîte de 100 × 100 (aussi utilisées dans les boutons).
export const COEUR = 'M50 88C26 70 6 54 6 33 6 18 17 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 25 0 21-20 37-44 55z';
export const ETOILE =
  'M' +
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 20 : 46;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(1)} ${(53 + r * Math.sin(a)).toFixed(1)}`;
  }).join('L') +
  'Z';

export const nbCases = (f: Format) => gabarit(f).cases.length;

export function gabarit(f: Format): { W: number; H: number; cases: Rect[]; texte: Rect } {
  if (f === 'bande3' || f === 'bande4') {
    const n = f === 'bande3' ? 3 : 4;
    const [W, H, m, g, bas] = [500, 1500, 30, 20, n === 3 ? 300 : 220];
    const h = Math.floor((H - m - bas - g * (n - 1)) / n);
    const fin = m + n * h + (n - 1) * g;
    return { W, H, cases: Array.from({ length: n }, (_, i) => ({ x: m, y: m + i * (h + g), w: W - 2 * m, h })), texte: { x: m, y: fin, w: W - 2 * m, h: H - fin } };
  }
  if (f === 'grille') {
    const [W, H, m, g, cw, ch] = [1000, 1500, 50, 30, 435, 560];
    const cases = [0, 1, 2, 3].map((i) => ({ x: m + (i % 2) * (cw + g), y: m + Math.floor(i / 2) * (ch + g), w: cw, h: ch }));
    const fin = m + 2 * ch + g;
    return { W, H, cases, texte: { x: m, y: fin, w: W - 2 * m, h: H - fin } };
  }
  return { W: 880, H: 1070, cases: [{ x: 60, y: 60, w: 760, h: 760 }], texte: { x: 60, y: 820, w: 760, h: 250 } };
}

/** Position de l'image dans sa case (en unités de la case) : « object-fit: cover » + zoom + décalage. */
export function placement(img: { width: number; height: number }, c: { w: number; h: number }, r: Recadrage) {
  const s = Math.max(c.w / img.width, c.h / img.height) * r.zoom;
  const w = img.width * s;
  const h = img.height * s;
  return { x: (-(w - c.w) * (r.x + 1)) / 2, y: (-(h - c.h) * (r.y + 1)) / 2, w, h };
}

// Petit générateur pseudo-aléatoire : le grain est le même à chaque rendu (pas de scintillement).
function hasard(graine: number) {
  return () => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Filtres pixel par pixel (ctx.filter n'existe pas dans Safari).
function filtrer(ctx: CanvasRenderingContext2D, w: number, h: number, f: Filtre, graine: number) {
  if (f === 'aucun' || !w || !h) return;
  const d = ctx.getImageData(0, 0, w, h);
  const p = d.data;
  const rnd = hasard(graine);
  for (let i = 0, k = 0; i < p.length; i += 4, k++) {
    let [r, g, b] = [p[i], p[i + 1], p[i + 2]];
    if (f === 'nb') {
      r = g = b = (0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.12 + 128;
    } else if (f === 'chaud') {
      [r, g, b] = [r * 1.08 + 12, g * 1.03 + 5, b * 0.86];
    } else {
      const s = [0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b];
      if (f === 'sepia') [r, g, b] = s;
      else {
        // vintage : sépia léger, noirs délavés, vignettage et grain
        const x = ((k % w) / w - 0.5) * 2;
        const y = (Math.floor(k / w) / h - 0.5) * 2;
        const v = 1 - 0.18 * (x * x + y * y);
        const n = (rnd() - 0.5) * 34;
        [r, g, b] = [0, 1, 2].map((c) => ([r, g, b][c] * 0.45 + s[c] * 0.55) * 0.84 * v + 30 + n);
      }
    }
    [p[i], p[i + 1], p[i + 2]] = [r, g, b];
  }
  ctx.putImageData(d, 0, 0);
}

const tampon = document.createElement('canvas');
const POLICES = { manuscrite: (t: number) => `600 ${t}px "Dancing Script"`, elegante: (t: number) => `italic 500 ${t}px "Playfair Display"` };

export const preparerPolices = () =>
  Promise.all([document.fonts.load(POLICES.manuscrite(40)), document.fonts.load(POLICES.elegante(40))]).catch(() => {});

/**
 * Dessine la création. echelle = pixels par unité (0,1 mm). images[i] = image de reglages.photos[i].
 * surbrillance = numéro de la case à entourer (aperçu seulement).
 */
export function dessiner(canvas: HTMLCanvasElement, r: Reglages, images: (HTMLImageElement | undefined)[], echelle: number, surbrillance = -1) {
  const g = gabarit(r.format);
  const cadre = CADRES.find((c) => c.id === r.cadre) ?? CADRES[0];
  canvas.width = Math.round(g.W * echelle);
  canvas.height = Math.round(g.H * echelle);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cadre.fond;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  g.cases.forEach((c, i) => {
    const [x, y, w, h] = [c.x, c.y, c.w, c.h].map((v) => Math.round(v * echelle));
    const img = r.photos.length ? images[i % r.photos.length] : undefined;
    if (!img || !w || !h) {
      ctx.fillStyle = 'rgba(0,0,0,.1)';
      ctx.fillRect(x, y, w, h);
      return;
    }
    tampon.width = w;
    tampon.height = h;
    const t = tampon.getContext('2d', { willReadFrequently: true })!;
    const pl = placement({ width: img.naturalWidth, height: img.naturalHeight }, { w, h }, r.recadrages[i] ?? { x: 0, y: 0, zoom: 1 });
    t.drawImage(img, pl.x, pl.y, pl.w, pl.h);
    filtrer(t, w, h, r.filtre, i + 1);
    ctx.drawImage(tampon, x, y);
  });

  // Texte et décorations, en unités
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.fillStyle = cadre.encre;
  const z = g.texte;
  const lignes = r.texte.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2 - z.h * 0.05;
  let taille = z.h * (lignes.length > 1 ? 0.3 : 0.4);
  let largeur = 0;
  if (lignes.length) {
    ctx.font = POLICES[r.police](taille);
    const max = z.w * (r.deco === 'aucune' ? 0.94 : 0.72);
    const mesure = Math.max(...lignes.map((l) => ctx.measureText(l).width));
    if (mesure > max) taille *= max / mesure;
    ctx.font = POLICES[r.police](taille);
    largeur = Math.min(mesure, max);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lignes.forEach((l, i) => ctx.fillText(l, cx, cy + (i - (lignes.length - 1) / 2) * taille * 1.15));
  }
  if (r.deco !== 'aucune') {
    const forme = new Path2D(r.deco === 'coeurs' ? COEUR : ETOILE);
    const t = Math.min(z.h * 0.16, z.w * 0.09);
    const symbole = (x: number, y: number, k = 1) => {
      ctx.save();
      ctx.translate(x - (t * k) / 2, y - (t * k) / 2);
      ctx.scale((t * k) / 100, (t * k) / 100);
      ctx.fill(forme);
      ctx.restore();
    };
    if (lignes.length) {
      const ecart = largeur / 2 + t * 0.9;
      symbole(cx - ecart, cy);
      symbole(cx + ecart, cy);
      symbole(cx + ecart + t * 0.75, cy - t * 0.7, 0.55);
    } else {
      [-1.6, 0, 1.6].forEach((d, i) => symbole(cx + d * t, cy, i === 1 ? 1.3 : 0.9));
    }
  }

  if (surbrillance >= 0 && g.cases[surbrillance]) {
    const c = g.cases[surbrillance];
    ctx.strokeStyle = cadre.encre;
    ctx.lineWidth = 2.5 / (echelle / devicePixelRatio);
    ctx.setLineDash([8 / (echelle / devicePixelRatio), 6 / (echelle / devicePixelRatio)]);
    ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
