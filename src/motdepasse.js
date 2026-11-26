// Partagé par le site et par scripts/encrypt.mjs : les deux doivent transformer le mot de passe pareil.
// Pour qu'il soit facile à deviner au téléphone : sans majuscules, sans accents, sans espaces autour.
/** @param {string} s */
export const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
