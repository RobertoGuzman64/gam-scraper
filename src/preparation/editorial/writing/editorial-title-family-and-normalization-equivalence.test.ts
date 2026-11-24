import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import { normalizeEditorialGeneral, normalizeEditorialTitle } from "../core/editorial-normalization.js";
import { presentCommercialMotorization } from "../identity/editorial-motorization.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { normalizePreparedEditorialPresentation } from "./prepared-editorial-presentation.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaForklift } from "../core/editorial-contract-records.js";

test("compone familia, identidad, motorización y altura con datos de una unidad nueva compatible", () => {
  const old = controlledGomarizPlatform();
  const next: ProductRecord = {
    ...old,
    reference: "CONTROL-PLATAFORMA-NUEVA",
    url: "https://www.gomarizrent.com/producto/marca-modelo10-nueva/",
    specs: { ...old.specs, "Altura de trabajo": "12 m" }
  };
  assert.equal(resolveEditorialFacts(next)?.workingHeightM, 12);
  assert.equal(resolvePreparedEditorialTitle(next, next), "Plataforma de tijera eléctrica MARCA MODELO10 · 12 m de trabajo");
  assert.equal(prepareSourceProduct(next).product.title, "Plataforma de tijera eléctrica MARCA MODELO10 · 12 m de trabajo");
  assert.equal(resolvePreparedEditorialTitle(old, old), "Plataforma de tijera eléctrica MARCA MODELO10 · 10 m de trabajo");
  const different = { ...next, model: "MODELO11", title: "Plataforma de tijera eléctrica MARCA MODELO11", url: "https://www.gomarizrent.com/producto/marca-modelo11-nueva/" };
  assert.equal(resolveEditorialFacts(different)?.workingHeightM, 12);
  assert.equal(resolvePreparedEditorialTitle(different, different), "Plataforma de tijera eléctrica MARCA MODELO11 · 12 m de trabajo");
  const mismatched = { ...different, model: "MODELO12" };
  assert.equal(resolveEditorialFacts(mismatched), null);
  assert.equal(resolvePreparedEditorialTitle(mismatched, mismatched), mismatched.title);
});

test("reutiliza títulos de manutención en otros proveedores sin retener el peso de una unidad", () => {
  for (const original of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const next: ProductRecord = {
      ...original,
      reference: `${original.reference}-NUEVA`,
      url: original.url?.replace(original.reference ?? "", `${original.reference}-NUEVA`) ?? null,
      specs: { ...original.specs }
    };
    const first = resolvePreparedEditorialTitle(original, original);
    const second = resolvePreparedEditorialTitle(next, next);
    assert.equal(first, "Carretilla elevadora MARCA MODELO10");
    assert.equal(second, first);
    assert.equal(prepareSourceProduct(next).product.title, second);
    assert.equal(prepareSourceProduct(next).product.reference, next.reference);
    assert.equal(prepareSourceProduct(next).product.sourceUrl, next.url);
  }
});

test("no introduce atributos por identidad, fuente, familia o magnitudes no corroboradas", () => {
  const original = controlledGomarizPlatform();
  for (const invalid of [
    { ...original, providerId: "gam" },
    { ...original, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...original, model: "MODELO11" },
    { ...original, specs: { ...original.specs, Marca: "OTRA" } },
    { ...original, specs: { ...original.specs, "Altura de trabajo": "12 kg" } },
    { ...original, title: "Plataforma de tijera eléctrica diésel MARCA MODELO10" }
  ]) {
    assert.equal(resolveEditorialFacts(invalid), null);
    assert.equal(resolvePreparedEditorialTitle(invalid, invalid), invalid.title);
  }
});

test("normaliza prefijos, familia y unidades, preservando el modelo y el concepto de magnitud", () => {
  assert.equal(normalizeEditorialTitle("Compra PLATAFORMA DE TIJERA ELECTRICA 10MT MARCA MODELO10", "MODELO10"),
    "Plataforma de tijera eléctrica 10 m MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("Compra CARRETILLA ELEVADORA DIESEL 2500KG MARCA MODELO10", "MODELO10"),
    "Carretilla elevadora diésel 2500 kg MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("PLATAFORMA ELECTRICA 10KG MARCA MODELO10", "MODELO10"),
    "Plataforma eléctrica 10 kg MARCA MODELO10");
  assert.equal(normalizeEditorialTitle("PLATAFORMA ELECTRICA 10MT MARCA MODELO10", "MODELO10")?.endsWith("MODELO10"), true);
});

test("incorpora motorización de ficha solo con valor permitido, sin duplicarla", () => {
  const title = "Plataforma articulada MARCA MODELO10";
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Eléctrico" } }),
    "Plataforma articulada eléctrica MARCA MODELO10");
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Diésel" } }),
    "Plataforma articulada diésel MARCA MODELO10");
  assert.equal(presentCommercialMotorization(title, { spec: { Motor: "Eléctrico / Diésel" } }), title);
  assert.equal(presentCommercialMotorization("Plataforma articulada diésel MARCA MODELO10", { spec: { Motor: "Eléctrico" } }),
    "Plataforma articulada diésel MARCA MODELO10");
});


test("aplica la normalización dentro de la presentación comercial sin cambiar la unidad ni sus datos", () => {
  const source = controlledGomarizPlatform();
  const prepared = prepareSourceProduct(source).product;
  const rawTitle = "Compra PLATAFORMA DE TIJERA ELECTRICA 10MT MARCA MODELO10";
  const corrected = normalizePreparedEditorialPresentation(source, {
    ...prepared, title: rawTitle, description_title: rawTitle
  });
  assert.equal(corrected.title, "Plataforma de tijera eléctrica 10 m MARCA MODELO10");
  assert.equal(corrected.description_title, corrected.title);
  assert.equal(corrected.reference, source.reference);
  assert.equal(corrected.sourceUrl, source.url);
  assert.deepEqual(corrected.spec, prepared.spec);
  assert.deepEqual(corrected.attributes, prepared.attributes);
  assert.deepEqual(normalizePreparedEditorialPresentation(source, corrected), corrected);
  assert.throws(() => normalizePreparedEditorialPresentation({ ...source, reference: "OTRA" }, prepared),
    /Identidad editorial discordante/u);
});

test("las referencias técnicas no convierten sufijos de alternador en metros", () => {
  const text = "Grupo Pramac GSW65P: alternador Mecc Alte ECP 32 2M B; cable de 4mm y peso de 1060KG.";
  const normalized = normalizeEditorialGeneral(text, "GSW65P");
  assert.equal(normalized,
    "Grupo Pramac GSW65P: alternador Mecc Alte ECP 32 2M B; cable de 4 mm y peso de 1060 kg.");
  assert.equal(normalizeEditorialGeneral(normalized, "GSW65P"), normalized);
  assert.equal(normalizeEditorialTitle("GRUPO ELECTROGENO PRAMAC GSW65P ECP 32 2M B", "GSW65P"),
    "GRUPO ELECTROGENO PRAMAC GSW65P ECP 32 2M B");
});

test("las citas literales de origen conservan grafías anómalas sin impedir normalizar magnitudes acreditadas", () => {
  const text = "El anuncio declara «4.30mm» y la ficha técnica expresa 4300mm de elevación y 2500KG de carga.";
  const normalized = normalizeEditorialGeneral(text, "C250HX4");
  assert.equal(normalized,
    "El anuncio declara «4.30mm» y la ficha técnica expresa 4300 mm de elevación y 2500 kg de carga.");
  assert.equal(normalizeEditorialGeneral(normalized, "C250HX4"), normalized);
  assert.equal(normalizeEditorialGeneral("Texto con 12m y cita «8M»; carga 230KG.", null),
    "Texto con 12 m y cita «8M»; carga 230 kg.");
});


test("las citas técnicas literales múltiples y las medidas fuera de ellas permanecen separadas", () => {
  const text = "Código «8M» y denominación «modelo 4.30mm»; altura de trabajo 8M, carga 230KG y longitud 1450mm.";
  const expected = "Código «8M» y denominación «modelo 4.30mm»; altura de trabajo 8 m, carga 230 kg y longitud 1450 mm.";
  assert.equal(normalizeEditorialGeneral(text, null), expected);
  assert.equal(normalizeEditorialGeneral(expected, null), expected);
  assert.equal(normalizeEditorialGeneral("Altura «8M» y texto sin cierre «12KG, masa 1000KG.", null),
    "Altura «8M» y texto sin cierre «12 kg, masa 1000 kg.");
});
