import { formatScriptStatus } from "../terminal.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const indexPath = join(root, "data/editorial/knowledge/verified-units.json");
const fields = [
  "url", "title", "brand", "model", "externalReference", "condition", "categoryKey",
  "year", "horometer", "shortDescription", "longDescription", "specs"
];
const linkFields = ["verificationUrl", "manufacturerUrl", "manufacturerSource", "supplierSource"];
const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const digest = (record) => createHash("sha256").update(JSON.stringify(Object.fromEntries(
  fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]])
))).digest("hex");
const byKey = new Map();
for (const provider of ["gam", "gomariz", "mercaeleva"]) {
  const catalog = read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`);
  if (!Array.isArray(catalog.products)) throw new Error(`Catálogo original inválido: ${provider}`);
  for (const record of catalog.products) {
    const key = `${record.providerId}:${record.reference}`;
    if (record.providerId !== provider || !record.reference || byKey.has(key)) {
      throw new Error(`Identidad duplicada o inválida en originales: ${key}`);
    }
    byKey.set(key, record);
  }
}
const current = read("data/editorial/knowledge/verified-units.json");
if (current.version !== 1 || !Array.isArray(current.entries)) throw new Error("Índice editorial inválido");
const identityKeys = new Set();
const seen = new Set();
const fold = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim().toLowerCase();
for (const entry of current.entries) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
    !/^(gam|gomariz|mercaeleva):[^:]+$/u.test(entry.key) ||
    typeof entry.brand !== "string" || typeof entry.model !== "string" ||
    typeof entry.sourceUrl !== "string" ||
    !/^[a-f\d]{64}$/u.test(entry.sourceDigest) ||
    !["short", "general", "title"].some((field) => typeof entry[field] === "string" && entry[field].trim()) ||
    ["short", "general", "title"].some((field) => entry[field] !== null && typeof entry[field] !== "string") ||
    !Number.isSafeInteger(entry.priority) || entry.priority < 0 ||
    entry.usage !== undefined && entry.usage !== "fallback" ||
    entry.identityOverride !== undefined && entry.identityOverride !== true ||
    Object.keys(entry).some((field) => ![
      "key", "brand", "model", "sourceUrl", "sourceDigest", "short", "general", "title",
      "priority", "identityOverride", "usage", ...linkFields
    ].includes(field))) {
    throw new Error(`Entrada editorial inválida: ${entry?.key ?? "sin clave"}`);
  }
  for (const field of linkFields) {
    if (entry[field] === undefined) continue;
    if (typeof entry[field] !== "string") throw new Error(`Procedencia inválida: ${entry.key}/${field}`);
    const url = new URL(entry[field]);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error(`Procedencia inválida: ${entry.key}/${field}`);
    }
  }
  const record = byKey.get(entry.key);
  if (!record || record.url !== entry.sourceUrl ||
    fold(record.brand) !== fold(entry.brand) || fold(record.model) !== fold(entry.model) ||
    digest(record) !== entry.sourceDigest) {
    throw new Error(`Conocimiento sin identidad o huella de original vigente: ${entry.key}`);
  }
  const signature = JSON.stringify([entry.key, entry.sourceDigest, entry.short, entry.general, entry.title, entry.priority, entry.usage ?? null]);
  if (seen.has(signature)) throw new Error(`Conocimiento firmado duplicado: ${entry.key}`);
  seen.add(signature);
  identityKeys.add(entry.key);
}
const output = JSON.stringify(current, null, 2) + "\n";
if (!process.argv.includes("--check")) {
  writeFileSync(indexPath, output);
}
console.log(formatScriptStatus("PASS", `CONOCIMIENTO EDITORIAL | ${current.entries.length} entradas · ${identityKeys.size} unidades · huellas y procedencias válidas`));
