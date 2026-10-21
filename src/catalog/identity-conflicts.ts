import { buildProductIdentity } from "./identity.js";
import type { ProductRecord } from "../contracts/catalog.js";

const canonicalUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
};

export const findIdentityConflicts = (products: readonly ProductRecord[]): readonly string[] => {
  const byIdentity = new Map<string, ProductRecord>();
  const serialByIdentity = new Map<string, string>();
  const conditionByIdentity = new Map<string, ProductRecord["condition"]>();
  const byUrl = new Map<string, ProductRecord>();
  const conflicts = new Set<string>();
  const normalize = (value: string | null): string => (value ?? "").trim().toLocaleLowerCase("es");

  for (const product of products) {
    const key = buildProductIdentity(product).key;
    const urlKey = `${normalize(product.providerId)}:${canonicalUrl(product.url)}`;
    const previous = byIdentity.get(key);
    if (previous) {
      if (canonicalUrl(previous.url) !== canonicalUrl(product.url)) {
        conflicts.add(`Identidad ${key} asignada a fichas distintas: ${previous.url} / ${product.url}`);
      }
    } else byIdentity.set(key, product);

    const normalizedSerial = normalize(product.serialNumber);
    const knownSerial = serialByIdentity.get(key);
    if (knownSerial && normalizedSerial && normalizedSerial !== knownSerial) {
      conflicts.add(`Identidad ${key} con números de serie contradictorios`);
    } else if (normalizedSerial && !knownSerial) serialByIdentity.set(key, normalizedSerial);
    const knownCondition = conditionByIdentity.get(key);
    if (knownCondition && product.condition && knownCondition !== product.condition) {
      conflicts.add(`Identidad ${key} con estados de maquinaria contradictorios`);
    } else if (product.condition && !knownCondition) conditionByIdentity.set(key, product.condition);

    const previousUrl = byUrl.get(urlKey);
    if (previousUrl && previousUrl.reference && product.reference &&
      normalize(previousUrl.reference) !== normalize(product.reference)) {
      conflicts.add(`Ficha ${product.url} con referencias contradictorias`);
    } else if (!previousUrl) byUrl.set(urlKey, product);

  }
  return [...conflicts];
};

export const findSerialNumberCollisions = (products: readonly ProductRecord[]): readonly {
  readonly providerId: string;
  readonly serialNumber: string;
  readonly products: readonly ProductRecord[];
}[] => {
  const groups = new Map<string, {
    providerId: string;
    serialNumber: string;
    byReference: Map<string, ProductRecord>;
  }>();
  const normalize = (value: string): string => value.trim().toLocaleLowerCase("es");

  for (const product of products) {
    const serialNumber = product.serialNumber?.trim();
    const reference = product.reference?.trim();
    if (!serialNumber || !reference) continue;
    const key = `${normalize(product.providerId)}:${normalize(serialNumber)}`;
    let group = groups.get(key);
    if (!group) {
      group = { providerId: product.providerId, serialNumber, byReference: new Map() };
      groups.set(key, group);
    }
    const referenceKey = normalize(reference);
    if (!group.byReference.has(referenceKey)) group.byReference.set(referenceKey, product);
  }

  return [...groups.values()]
    .filter((group) => group.byReference.size > 1)
    .map((group) => ({
      providerId: group.providerId,
      serialNumber: group.serialNumber,
      products: [...group.byReference.values()]
    }));
};

export const describeSerialNumberCollision = (collision: ReturnType<typeof findSerialNumberCollisions>[number]): string =>
  `Número de serie ${collision.serialNumber} asociado a referencias distintas en ${collision.providerId}: ${collision.products
    .map((product) => `${product.reference} (${product.url})`).join(" / ")}`;

