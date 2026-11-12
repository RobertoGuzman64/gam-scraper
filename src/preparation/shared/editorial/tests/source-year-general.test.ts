import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { includeSourceYearInGeneral } from "../mapping/source-year-general.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "./editorial-contract-records.js";

const general = "Información técnica contrastada de la máquina.";
const apply = (record: ProductRecord): string | null =>
  includeSourceYearInGeneral(record, general, record.shortDescription, record.specs ?? {});

test("año declarado en ficha: se añade únicamente bajo corroboración de fuente y unidad", () => {
  const gam = controlledGamForklift();
  const withGamYear: ProductRecord = { ...gam, year: "2022", yearSource: "ficha",
    specs: { ...gam.specs, "Año de fabricación": "2022" } };
  const gomariz = controlledGomarizPlatform();
  const withGomarizYear: ProductRecord = { ...gomariz, year: "2022",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/plataforma-tijera/marca-modelo10/",
    shortDescription: "Año 2022", specs: { ...gomariz.specs, "Año de fabricación": "2022" } };
  const mercaeleva = controlledMercaelevaForklift();
  const withMercaYear: ProductRecord = { ...mercaeleva, year: "2022",
    specs: { ...mercaeleva.specs, "Año de fabricación": "2022", Marca: "MARCA", Modelo: "MODELO10" } };
  for (const source of [withGamYear, withGomarizYear, withMercaYear]) {
    const before = JSON.stringify(source);
    assert.equal(apply(source), `${general} Año de fabricación de esta unidad: 2022.`);
    assert.equal(JSON.stringify(source), before);
  }
});

test("años ambiguos, información no corroborada y variantes no autorizadas no generan afirmaciones", () => {
  const gam = controlledGamForklift();
  const gomariz = controlledGomarizPlatform();
  const mercaeleva = controlledMercaelevaForklift();
  const invalid: readonly ProductRecord[] = [
    { ...gam, year: "2022", yearSource: "ficha" },
    { ...gam, year: "2022", yearSource: "ficha", specs: { ...gam.specs, "Año de fabricación": "2021" } },
    { ...gam, year: "2022", yearSource: "ficha", url: "https://example.invalid/otra" },
    { ...gam, year: "2022", yearSource: "titulo", specs: { ...gam.specs, "Año de fabricación": "2022" } },
    { ...gam, year: "año incierto" },
    { ...gomariz, year: "2022", shortDescription: "Año 2022", specs: { ...gomariz.specs, "Año de fabricación": "2022" } },
    { ...mercaeleva, year: "2022", specs: { ...mercaeleva.specs, "Año de fabricación": "2022", "Año del modelo": "2023" } },
    { ...mercaeleva, year: "2022", specs: { ...mercaeleva.specs, "Año de fabricación": "2022", Marca: "OTRA", Modelo: "MODELO10" } }
  ];
  for (const [index, source] of invalid.entries()) assert.equal(apply(source), general, String(index));
  const verified = { ...gam, year: "2022", yearSource: "ficha" as const,
    specs: { ...gam.specs, "Año de fabricación": "2022" } };
  assert.equal(includeSourceYearInGeneral(verified, "Descripción del año 2022.", null, verified.specs), "Descripción del año 2022.");
});
