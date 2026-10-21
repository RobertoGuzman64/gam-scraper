export type ProductDescriptions = {
  readonly short: string | null;
  readonly long: string | null;
};

const normalize = (value: string | null | undefined): string | null =>
  value?.replace(/\s+/g, " ").trim() || null;

export const distinguishDescriptions = (short: string | null | undefined, long: string | null | undefined): ProductDescriptions => {
  const shortText = short?.trim() || null;
  const longText = long?.trim() || null;
  if (!shortText) return { short: null, long: longText };
  if (!longText || normalize(shortText) === normalize(longText)) return { short: null, long: longText ?? shortText };
  return { short: shortText, long: longText };
};
