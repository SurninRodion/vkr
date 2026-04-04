/**
 * Склонение существительных после числа (рус.).
 * @param {number} n
 * @param {[string, string, string]} forms — [1, 2–4, 5–20 и т.д.]
 */
export function pluralRu(n, forms) {
  const [one, few, many] = forms;
  const abs = Math.abs(Number(n)) | 0;
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
