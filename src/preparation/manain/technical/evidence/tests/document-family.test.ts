import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { manainDocumentFamily } from "../document-family.js";
import { manainSourceFamily } from "../source.js";
import { manainCategorySlug } from "../../../classification/mapping/categories.js";

const source = (reference: string, family: string, specs?: ProductRecord["specs"]): ProductRecord => ({
  providerId: "manain", reference, categoryKey: family, categoryName: family,
  url: `https://manain.com/?sku=${reference}`, title: "MARCA MODELO", brand: "MARCA", model: "MODELO",
  shortDescription: null, longDescription: null, price: "1000 €", condition: "Segunda mano",
  year: "2024", horometer: "123", serialNumber: null, image: null, location: null, country: null,
  ...(specs === undefined ? {} : { specs })
});

test("Manain: el origen documental clasifica familias y energías sin depender de slugs web", () => {
  const cases = [
    ["AD-12 ARTICULADA DIESEL", "elevacion-brazo-articulado", "plataformas-articuladas-diesel-segunda-mano"],
    ["AE-11 ARTICULADA ELECTRICA", "elevacion-brazo-articulado", "plataformas-articuladas-electricas-segunda-mano"],
    ["TD-12 TIJERA DIESEL", "elevacion-tijera", "plataformas-tijera-diesel-segunda-mano"],
    ["TE-8 TIJERA ELECTRICA", "elevacion-tijera", "plataformas-tijera-electricas-segunda-mano"],
    ["CDO-25 CARRETILLA DIESEL", "manipulacion-carretilla", "carretillas-elevadoras-diesel-segunda-mano"],
    ["CE-25 CARRETILLA ELECTRICA", "manipulacion-carretilla", "carretillas-elevadoras-electricas-segunda-mano"],
    ["ME-27 MINI EXCAVADORA 2700KG", "movimiento-tierra-miniexcavadora", "miniexcavadoras-segunda-mano"],
    ["MAR-27 MARTILLO EXCAVACION", "movimiento-tierra-martillo-miniex", "cazos-implementos-segunda-mano"]
  ] as const;
  for (const [family, expectedFamily, expectedSlug] of cases) {
    const record = source("MA4100", family);
    assert.equal(manainSourceFamily(record), expectedFamily);
    assert.equal(manainCategorySlug(record, "Segunda_Mano"), expectedSlug);
  }
});

test("Manain: no se adivinan energías, familias desconocidas ni contradicciones", () => {
  const bienergy = source("MA4100", "TE-14 BI TIJERA BIENERGY");
  assert.equal(manainDocumentFamily(bienergy)?.energy, null);
  assert.equal(manainCategorySlug(bienergy, "Segunda_Mano"), null);
  const manual = source("MA4100", "TRAS-M TRANSPALETA MANUAL");
  assert.equal(manainSourceFamily(manual), "manipulacion-transpaletas");
  assert.equal(manainCategorySlug(manual, "Segunda_Mano"), null);
  const unknown = source("MA4100", "TE-8 ARTICULADA DIESEL");
  assert.equal(manainSourceFamily(unknown), null);
  const wrongIdentity = { ...source("MA4100", "AD-12 ARTICULADA DIESEL"), url: "https://manain.com/?sku=MA9999" };
  assert.equal(manainSourceFamily(wrongIdentity), null);
  const conflictingMotor = source("MA4100", "TE-8 TIJERA ELECTRICA", { Motor: "Diésel" });
  assert.equal(manainCategorySlug(conflictingMotor, "Segunda_Mano"), null);
});
