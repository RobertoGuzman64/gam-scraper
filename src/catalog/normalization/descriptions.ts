export type ProductDescriptions = {
  readonly short: string | null;
  readonly long: string | null;
};

export const distinguishDescriptions = (short: string | null | undefined, long: string | null | undefined): ProductDescriptions => ({
  short: short?.trim() || null,
  long: long?.trim() || null
});
