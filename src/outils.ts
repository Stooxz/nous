export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const $ = <T extends Element = HTMLElement>(sel: string, racine: ParentNode = document) => racine.querySelector(sel) as T;

/** Au téléphone : feuille de partage (pour « Enregistrer l'image » dans Photos). Sinon : téléchargement. */
export async function enregistrerFichier(blob: Blob, nom: string) {
  const fichier = new File([blob], nom, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
