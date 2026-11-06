import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";

export type CommercialMetadata = {
  readonly tags: readonly string[];
  readonly keywords: readonly string[];
  readonly featured: false;
};

export type CommercialPresentation = Pick<ImportCandidate,
  "title" | "description_title" | "description" | "description_general" | "image" | "images" | "spec"
> & { readonly metadata: CommercialMetadata };

export const commercialToken = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");

const unique = (values: readonly (string | null)[]): string[] => [
  ...new Set(values.filter((value): value is string => value !== null && value.length > 0))
];

export const commercialIdentityInTitle = (title: string | null, candidate: string | null): string | null => {
  if (!candidate?.trim()) return null;
  const token = commercialToken(candidate);
  const normalizedTitle = commercialToken(title ?? "");
  return token && (`-${normalizedTitle}-`).includes(`-${token}-`) ? token : null;
};

const confirmedSpecIdentity = (candidate: string | null, spec: unknown): string | null => {
  if (!candidate || typeof spec !== "string") return null;
  const expected = commercialToken(candidate);
  return expected && expected === commercialToken(spec) ? expected : null;
};

const conflictingModelVariant = (title: string | null, model: string | null): boolean => {
  if (!title || !model || commercialIdentityInTitle(title, model)) return false;
  const tokens = commercialToken(model).split("-");
  const suffix = /^(\d{2,})([a-z]+)$/u.exec(tokens.at(-1) ?? "");
  if (!suffix) {
    const modelToken = commercialToken(model).replace(/-/gu, "");
    const variant = /^([a-z]+\d{2,})([a-z]{2,})$/u.exec(modelToken);
    if (!variant) return false;
    return commercialToken(title).split("-").some((part) =>
      part.startsWith(modelToken) && part.length > modelToken.length &&
      /^([a-z]+\d{2,})([a-z]{3,})$/u.test(part)
    );
  }
  if (tokens.length < 2) return false;
  const stem = tokens.slice(0, -1).join("-");
  const titleToken = commercialToken(title);
  const sibling = new RegExp(`(?:^|-)${stem}-${suffix[1]}[a-z]+(?:-|$)`, "u");
  return sibling.test(titleToken);
};

const commercialTitle = (value: string | null, providerId: string): string | null => {
  const initial = value?.replace(/\s+/gu, " ").trim();
  if (!initial) return null;
  const withoutPrefix = initial.replace(/^(?:compra\s+)+/iu, "");
  const withoutSeller = providerId === "gam"
    ? withoutPrefix.replace(/\s*\|\s*GAM Online$/iu, "").trim()
    : withoutPrefix;
  return withoutSeller || initial;
};

export const projectCommercialPresentation = (
  source: ProductRecord, published: ImportCandidate, categoryName: string | null
): CommercialPresentation => {
  if (source.providerId !== published.providerId || source.url !== published.sourceUrl ||
    source.reference !== published.reference) {
    throw new Error(`Origen y publicación discordantes: ${published.providerId}:${published.reference ?? published.sourceUrl}`);
  }
  const title = commercialTitle(published.title, published.providerId);
  const brand = commercialIdentityInTitle(title, source.brand) ??
    confirmedSpecIdentity(source.brand, published.spec["Marca"]);
  const model = conflictingModelVariant(title, source.model) ? null :
    commercialIdentityInTitle(title, source.model) ??
    confirmedSpecIdentity(source.model, published.spec["Modelo"]);
  const category = categoryName ? commercialToken(categoryName) : null;
  const condition = published.condition ? commercialToken(published.condition) : null;
  const metadata: CommercialMetadata = {
    tags: unique(["maquinaria", condition, category, brand]),
    keywords: unique([category, brand, model, title ? commercialToken(title) : null]),
    featured: false
  };
  return {
    title,
    description_title: published.description_title?.trim() === published.title?.trim() || !published.description_title?.trim()
      ? title : commercialTitle(published.description_title, published.providerId),
    description: published.description,
    description_general: published.description_general,
    image: published.image,
    images: [...published.images],
    spec: { ...published.spec },
    metadata
  };
};
