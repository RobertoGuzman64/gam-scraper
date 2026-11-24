export const sourceEditorialMeasurement = (
  value: unknown, unit: "m" | "kg" | "kVA" | "V"
): string | null => {
  if (typeof value !== "string") return null;
  const match = /^([0-9]+(?:[.,][0-9]{1,2})?)\s*(m|kg|kva|v)$/iu.exec(value.trim());
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const numeric = Number(match[1].replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? match[1].replace(".", ",") : null;
};
