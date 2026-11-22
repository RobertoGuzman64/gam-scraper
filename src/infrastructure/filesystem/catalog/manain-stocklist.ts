import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseManainStocklist, type ManainStocklist } from "../../../preparation/manain/source/stocklist.js";

export type ManainStocklistManifest = {
  readonly version: 1;
  readonly providerId: "manain";
  readonly productCount: number;
  readonly stocklistSha256: string;
};

const originalFile = "manain-stocklist.json";
const manifestFile = "manain-stocklist.manifest.json";

const digest = (content: string): string => createHash("sha256").update(content).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const createManainStocklistManifest = (raw: string): ManainStocklistManifest => {
  const data: unknown = JSON.parse(raw);
  const stocklist = parseManainStocklist(data);
  return {
    version: 1,
    providerId: "manain",
    productCount: stocklist.productos.length,
    stocklistSha256: digest(raw)
  };
};

const parseManifest = (value: unknown): ManainStocklistManifest => {
  if (!isRecord(value) || Object.keys(value).length !== 4 || value.version !== 1 ||
    value.providerId !== "manain" || typeof value.productCount !== "number" ||
    !Number.isSafeInteger(value.productCount) || value.productCount < 1 ||
    typeof value.stocklistSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.stocklistSha256)) {
    throw new Error("Stocklist Manain: manifiesto inválido");
  }
  return {
    version: 1,
    providerId: "manain",
    productCount: value.productCount,
    stocklistSha256: value.stocklistSha256
  };
};

const readRegularFile = async (path: string): Promise<string> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Stocklist Manain: archivo no regular: ${path}`);
  return readFile(path, "utf8");
};

export const readManainStocklist = async (directory: string): Promise<{
  readonly stocklist: ManainStocklist;
  readonly stocklistSha256: string;
}> => {
  const base = resolve(directory);
  const [raw, rawManifest] = await Promise.all([
    readRegularFile(join(base, originalFile)),
    readRegularFile(join(base, manifestFile))
  ]);
  const data: unknown = JSON.parse(raw);
  const stocklist = parseManainStocklist(data);
  const manifestData: unknown = JSON.parse(rawManifest);
  const manifest = parseManifest(manifestData);
  const stocklistSha256 = digest(raw);
  if (manifest.stocklistSha256 !== stocklistSha256 ||
    manifest.productCount !== stocklist.productos.length) {
    throw new Error("Stocklist Manain: contenido alterado o manifiesto discordante");
  }
  return { stocklist, stocklistSha256 };
};
