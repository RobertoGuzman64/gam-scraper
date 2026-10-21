const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const validImage = (value: unknown, reference: string): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "files2.machineric.com" ||
      !url.pathname.includes(`/machines/${reference}/public/`) ||
      !/\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export type EmbeddedMachineMetadata = {
  readonly location: string | null;
  readonly country: string | null;
  readonly images: readonly string[];
};

export const extractEmbeddedMachineMetadata = (html: string, reference: string): EmbeddedMachineMetadata => {
  const empty: EmbeddedMachineMetadata = { location: null, country: null, images: [] };
  const source = html.replace(/\\"/g, '"').replace(/\\\//g, "/");
  const marker = `"machinericId":"${reference}"`;
  const position = source.indexOf(marker);
  if (position < 0) return empty;

  let location: string | null = null;
  let country: string | null = null;
  const locationPosition = source.lastIndexOf('"location":', position);
  if (locationPosition >= 0 && position - locationPosition < 750) {
    const start = source.indexOf("{", locationPosition);
    const end = source.indexOf("}", start + 1);
    if (start >= 0 && end > start && end < position) {
      try {
        const raw: unknown = JSON.parse(source.slice(start, end + 1));
        if (isRecord(raw)) {
          const parts = [readText(raw.city), readText(raw.state), readText(raw.zipCode)].filter((part): part is string => part !== null);
          location = parts.length ? parts.join(" · ") : null;
          country = readText(raw.countryCode);
        }
      } catch {
        location = null;
        country = null;
      }
    }
  }

  const picturePosition = source.indexOf('"pictures":', position + marker.length);
  const nextObject = source.indexOf('"machinericId":', position + marker.length);
  if (picturePosition < 0 || (nextObject >= 0 && nextObject < picturePosition)) return { location, country, images: [] };
  const start = source.indexOf("[", picturePosition);
  const end = source.indexOf('],"prices":', start + 1);
  if (start < 0 || end < 0 || end - start > 250_000) return { location, country, images: [] };

  let pictures: unknown;
  try {
    pictures = JSON.parse(source.slice(start, end + 1));
  } catch {
    return { location, country, images: [] };
  }
  if (!Array.isArray(pictures)) return { location, country, images: [] };

  const urls = new Set<string>();
  for (const picture of pictures) {
    if (!isRecord(picture)) continue;
    const url = validImage(picture.big ?? picture.medium, reference);
    if (url) urls.add(url);
  }
  return { location, country, images: [...urls] };
};

const readJsonArray = (source: string, start: number): readonly unknown[] | null => {
  if (source[start] !== "[") return null;
  let level = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(source.length, start + 100_000);
  for (let index = start; index < limit; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") level += 1;
    else if (character === "]") {
      level -= 1;
      if (level !== 0) continue;
      try {
        const result: unknown = JSON.parse(source.slice(start, index + 1));
        return Array.isArray(result) ? result : null;
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const extractEmbeddedMachinePrice = (html: string, reference: string): string | null => {
  const source = html.replace(/\\"/g, '"').replace(/\\\//g, "/");
  const marker = `"machinericId":"${reference}"`;
  const position = source.indexOf(marker);
  if (position < 0) return null;
  const pricesPosition = source.indexOf('"prices":', position + marker.length);
  const nextMachine = source.indexOf('"machinericId":', position + marker.length);
  if (pricesPosition < 0 || (nextMachine >= 0 && nextMachine < pricesPosition)) return null;
  const start = source.indexOf("[", pricesPosition + '"prices":'.length);
  if (start < 0 || start - pricesPosition > 20) return null;
  const prices = readJsonArray(source, start);
  if (!prices) return null;
  for (const candidate of prices) {
    if (!isRecord(candidate) || candidate.currency !== "EUR" || candidate.isStrikethroughPrice !== false) continue;
    const amount = candidate.priceExcludingVat;
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) return String(amount);
  }
  return null;
};
