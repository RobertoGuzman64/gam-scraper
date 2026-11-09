import { commercialToken } from "../projection/presentation-projection.js";
import { presentCommercialMotorization } from "../projection/motorization-presentation.js";

type CommercialIdentityPresentationIssues = {
  readonly unjustifiedTitleCollisions: number;
  readonly unjustifiedTitleExceptions: number;
  readonly missingMotorization: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const inspectCommercialIdentityPresentation = (
  products: readonly unknown[], exceptions: readonly unknown[], providerId: string
): CommercialIdentityPresentationIssues => {
  const titles = new Map<string, string[]>();
  let missingMotorization = 0;
  for (const product of products) {
    if (!isRecord(product) || typeof product.title !== "string" ||
      typeof product.sourceUrl !== "string") continue;
    const token = commercialToken(product.title);
    if (token) {
      const urls = titles.get(token) ?? [];
      urls.push(product.sourceUrl);
      titles.set(token, urls);
    }
    if (providerId === "gomariz" && isRecord(product.spec) &&
      presentCommercialMotorization(product.title, { providerId, spec: product.spec }) !== product.title) {
      missingMotorization += 1;
    }
  }
  const collided = new Set([...titles.values()].filter((urls) => urls.length > 1).flat());
  const justified = new Set<string>();
  for (const exception of exceptions) {
    if (isRecord(exception) && exception.reason === "titulo-unidad-no-diferenciada" &&
      typeof exception.sourceUrl === "string") justified.add(exception.sourceUrl);
  }
  return {
    unjustifiedTitleCollisions: [...collided].filter((url) => !justified.has(url)).length,
    unjustifiedTitleExceptions: [...justified].filter((url) => !collided.has(url)).length,
    missingMotorization
  };
};
