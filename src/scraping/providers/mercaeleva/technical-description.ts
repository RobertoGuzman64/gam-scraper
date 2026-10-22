const load = (text: string): number | null => {
  const parsed = Number(text.replace(/[\s.]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mastKind = (value: string): string =>
  /^(?:tr[ií]plex|triple)$/i.test(value) ? "triplex"
    : /^(?:d[uú]plex|doble)$/i.test(value) ? "duplex" : "simplex";

export const recoverMercaelevaDescriptionSpecs = (
  specs: Record<string, string>, description: string | null, title: string
): void => {
  if (!description || !/\b(?:carretilla|transpalet(?:a)?|apilador)\b/i.test(title)) return;

  if (!specs["Tipo de mástil"]) {
    const published = description.match(/\bm[aá]stil\s+(?:tipo\s+)?(tr[ií]plex|d[uú]plex|s[ií]mplex|triple|doble|simple)\b/i)?.[1];
    const options = [...description.matchAll(/\b(tr[ií]plex|d[uú]plex|s[ií]mplex|triple|doble|simple)\b/gi)]
      .map((match) => mastKind(match[1] ?? ""));
    if (published && new Set(options).size === 1) specs["Tipo de mástil"] = published;
  }

  if (!specs["Capacidad de carga"] && !specs["Capacidad máxima de elevación"]) {
    const published = description.match(/\bcapacidad(?:\s+de\s+carga)?\s*:?\s*(\d[\d., ]{0,10})\s*kg\b/i)?.[1];
    const capacity = published ? load(published) : null;
    if (capacity === null) return;
    const sourceLoads = [...description.matchAll(/\b(\d[\d., ]{0,10})\s*kg\b/gi)]
      .map((match) => load(match[1] ?? ""));
    const titleLoad = title.match(/\b(\d[\d., ]{0,10})\s*kg\b/i)?.[1];
    const announced = titleLoad ? load(titleLoad) : null;
    if (sourceLoads.length > 0 && sourceLoads.every((value) => value === capacity) &&
      (announced === null || announced === capacity)) specs["Capacidad de carga"] = `${published?.trim()} kg`;
  }
};
