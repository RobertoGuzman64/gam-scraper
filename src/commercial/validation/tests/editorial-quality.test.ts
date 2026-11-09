import assert from "node:assert/strict";
import test from "node:test";
import { inspectCommercialEditorialQuality } from "../editorial-quality.js";

const content = (title: string | null, description: string | null, description_general: string | null) =>
  ({ title, description, description_general });

test("separa defectos seguros de corregir de advertencias de evidencia de origen", () => {
  const result = inspectCommercialEditorialQuality(content("Carretilla 4.500mm", "tríplex tríplex en GAM Online",
    "La ficha original incluye valores del motor con cifras declaradas en la publicación. La información técnica se ha conservado y sigue vigente según el proveedor. Esta descripción termina de forma"));
  assert.deepEqual(result.map(({ reason, severity }) => [reason, severity]), [
    ["unidad-mm-sin-espacio", "blocking"],
    ["descriptor-mastil-duplicado", "blocking"],
    ["promocion-proveedor-en-resumen", "blocking"],
    ["descripcion-general-posiblemente-truncada", "review"]
  ]);
});

test("mantiene visibles las anomalías del origen que requieren acreditación", () => {
  const result = inspectCommercialEditorialQuality(content("PRAMAC GSW3365M", "Grupo electrógeno 3213 kWA",
    "Referencia de publicación. Características principales: Insonorización: Combustible: Lubricación: Refrigeración:"));
  assert.deepEqual(result.map((issue) => issue.reason), ["listado-origen-incompleto", "unidad-potencia-no-estandar"]);
  assert.ok(result.every((issue) => issue.severity === "review"));
});

test("no interpreta fichas concisas ni magnitudes legítimas como defectos", () => {
  assert.deepEqual(inspectCommercialEditorialQuality(content("GENIE GS-3246 de 12 m",
    "Altura de trabajo 12 m y capacidad de la cesta 227 kg", "Ficha publicada con año 2018 y motor eléctrico.")), []);
  assert.deepEqual(inspectCommercialEditorialQuality(content(null, null, null)), []);
  assert.deepEqual(inspectCommercialEditorialQuality(content("Modelo PK402", "Mástil tríplex", "Ref. MARCA S200.")), []);
});

test("detecta bloques del proveedor no normalizables sin alterar sus cifras", () => {
  const original = "Ref. MER1123 CARRETILLA RETRACTIL ELECTRICA 1350 KG ALTURA DE ELEVACION 6.500 mm TOYOTA 6FBRE14 AÑO 2000";
  const issues = inspectCommercialEditorialQuality(content("Toyota 6FBRE14", "Carretilla", original));
  assert.deepEqual(issues, [{ reason: "descripcion-origen-en-mayusculas", severity: "review" }]);
  assert.deepEqual(inspectCommercialEditorialQuality(content("Clásico", "Vehículo", "? Vehículo en buen estado ✔️")),
    [{ reason: "marcadores-origen-residuales", severity: "review" }]);
});
