export const matchesVerifiedHorometer = (observed: string | null, expected: string | null): boolean => {
  if (observed === null || expected === null) return observed === expected;
  const digits = (value: string): string | null => {
    if (!/^\d[\d\s]*(?:\s*h)?$/iu.test(value.trim())) return null;
    return value.replace(/\s*h$/iu, "").replace(/\s/gu, "");
  };
  const left = digits(observed);
  return left !== null && left === digits(expected);
};
