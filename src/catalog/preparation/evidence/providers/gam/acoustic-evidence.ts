import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const cleaningCategories = new Set(["limpieza-fregadoras", "limpieza-barredoras"]);
const soundLevel = /\bnivel\s+(?:de\s+ruido|sonoro|ac[uú]stico|de\s+sonido)\b[^.!?;\n]{0,90}?\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(dB(?:\s*\(\s*A\s*\)|A)?)(?![a-z])/giu;
const anySoundMeasure = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*dB(?:\s*\(\s*A\s*\)|A)?(?![a-z])/giu;
const existingSound = /\b(?:sonor[oa]|sonido|ruido|ac[uú]stic[oa])\b/iu;
const conditionalMode = /\b(?:modo\s+(?:eco|quiet)|quiet[- ]mode|versi[oó]n)\b/iu;

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hasOwnIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !cleaningCategories.has(record.categoryKey) || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(brand) !== normalize(record.specs["Marca"]) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

const acousticValue = (description: string): string | null => {
  const matches = [...description.matchAll(soundLevel)];
  if (matches.length === 0) return null;
  const measures = [...description.matchAll(anySoundMeasure)];
  if (measures.length !== matches.length) return null;
  const values = matches.map((match) => {
    const literal = match[1];
    const unit = match[2];
    if (!literal || !unit) return null;
    const numeric = Number(literal.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 40 || numeric > 100) return null;
    const before = description.slice(Math.max(0, (match.index ?? 0) - 80), match.index);
    const after = description.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 40);
    if (conditionalMode.test(before) || conditionalMode.test(after)) return null;
    return `${literal} ${/^dB\s*\(\s*A\s*\)$/iu.test(unit) ? "dB(A)" : /^dBA$/iu.test(unit) ? "dBA" : "dB"}`;
  });
  const first = values[0];
  return first && values.every((value) => value === first) ? first : null;
};

export const recoverGamAcousticSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!hasOwnIdentity(record) || Object.keys(source).some((key) => existingSound.test(key))) return source;
  const value = acousticValue(record.longDescription ?? "");
  return value === null ? source : { ...source, "Nivel sonoro": value };
};
