import type { SpecValue } from "../../../../contracts/catalog.js";

const folded = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

export const verifiedEditorialUrl = (sourceUrl: string, hostnames: readonly string[]): URL | null => {
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" && hostnames.includes(url.hostname) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      !url.pathname.includes("//") ? url : null;
  } catch {
    return null;
  }
};

export const containsEditorialSourceSlugModel = (
  slug: string, model: string, motor: SpecValue | undefined
): boolean => {
  const token = folded(model).replace(/[^a-z0-9]/gu, "");
  if (!token) return false;
  const characters = [...token].join("[^a-z0-9]{0,3}");
  const electric = typeof motor === "string" && /\bel[eé]ctric[oa]\b/iu.test(motor);
  const suffix = electric ? "|e(?=[^a-z0-9]|$)" : "";
  return new RegExp(`(?:^|[^a-z0-9])${characters}(?:$|[^a-z0-9]|tijera(?=[^a-z0-9]|$)${suffix})`, "u")
    .test(folded(slug));
};
