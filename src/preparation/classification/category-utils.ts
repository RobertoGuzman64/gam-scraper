export const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const energy = (value: string): "electric" | "diesel" | null => {
  const text = fold(value);
  const electric = /\belectric[oa]s?\b/.test(text);
  const diesel = /\bdiesel\b/.test(text);
  const other = /\bgasolina\b|\bglp\b|\bhibrid[oa]\b/.test(text);
  if (other) return null;
  return electric === diesel ? null : electric ? "electric" : "diesel";
};

