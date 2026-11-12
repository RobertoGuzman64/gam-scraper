import type { ProductRecord } from "../../../../contracts/catalog.js";

type GomarizEditorialFamily = {
  readonly section: string;
  readonly key: string;
};

export const resolveGomarizEditorialFamily = (record: ProductRecord): GomarizEditorialFamily | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" ||
      !["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname) ||
      path.length !== 4 || path[0] !== "venta" || !path[1] || !path[2]) return null;
    return { section: path[1], key: path[2] };
  } catch {
    return null;
  }
};
