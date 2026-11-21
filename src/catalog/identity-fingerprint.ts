import type { ProductRecord } from "../contracts/catalog.js";
import { createHash } from "node:crypto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Registro original no serializable");
  return encoded;
};

export const originalRecordFingerprint = (original: ProductRecord): string => createHash("sha256").update(canonicalJson(original)).digest("hex");

