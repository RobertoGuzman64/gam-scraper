const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

export const brandFromTitle = (title: string, pageUrl: string): string | null => {
  const tokens = title.split(/\s+/);
  const first = tokens[0];
  const second = tokens[1];
  if (!first || !second || !/^[\p{L}]+(?:-[\p{L}]+)*$/u.test(first)) return null;
  if (!/\d/.test(second) && !(tokens.length === 3 && /^[A-Z]{2,5}$/.test(second) && /^\d+[A-Za-z]?$/.test(tokens[2] ?? ""))) return null;
  try {
    const url = new URL(pageUrl);
    if (!/^(?:www\.)?gomarizrent\.com$/.test(url.hostname)) return null;
    const slug = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const titlePrefix = `${fold(first)}-${fold(second)}`.replace(/[^a-z0-9-]/g, "-");
    return slug.startsWith(`${titlePrefix}-`) || slug === titlePrefix ? first : null;
  } catch {
    return null;
  }
};

export const modelFromTitle = (title: string, brand: string | null): string | null => {
  if (!brand) return null;
  const titleTokens = title.split(/\s+/);
  const brandTokens = brand.split(/\s+/).map(fold);
  if (titleTokens.length <= brandTokens.length || new Set(brandTokens).size !== brandTokens.length) return null;
  const prefix = titleTokens.slice(0, brandTokens.length).map(fold);
  if (new Set(prefix).size !== brandTokens.length || !prefix.every((token) => brandTokens.includes(token))) return null;
  const model = normalize(titleTokens.slice(brandTokens.length).join(" "));
  return /\d/.test(model) ? model : null;
};

