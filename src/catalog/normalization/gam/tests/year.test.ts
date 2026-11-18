import assert from "node:assert/strict";
import test from "node:test";
import { explicitGamTitleYear, gamSourceYear, gamUrlYear } from "../year.js";

test("los años de fabricación declarados expresamente en un título son distinguibles de capacidades y modelos", () => {
  assert.equal(explicitGamTitleYear("Máquina de ocasión, año 2018, capacidad 2000 Kg"), "2018");
  assert.equal(explicitGamTitleYear("Máquina fabricada en el año 2016"), "2016");
  assert.equal(explicitGamTitleYear("Plataforma · Año de fabricación: 2017"), "2017");
  assert.equal(explicitGamTitleYear("Preparapedidos 2000 Kg YALE MO20P"), null);
  assert.equal(explicitGamTitleYear("Plataforma JLG 1930 ES, 2000 kg"), null);
  assert.equal(explicitGamTitleYear("Transpaleta eléctrica de ocasión"), null);
  assert.equal(explicitGamTitleYear(null), null);
});

test("solo extrae un año del segmento de unidad de la URL oficial exacta", () => {
  const url = "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6588-2019-yale-mo20p";
  assert.equal(gamUrlYear(url, "6588"), "2019");
  assert.equal(gamUrlYear(url), "2019");
  for (const other of [
    [url, "6590"],
    [url.replace("6588-2019-", "6588-preparapedidos-"), "6588"],
    [url.replace("online.gamrentals.com", "example.com"), "6588"],
    [url.replace("https:", "http:"), "6588"],
    [`${url}?id=6588`, "6588"],
    [`${url}#equipo`, "6588"],
    ["https://online.gamrentals.com/es/yale/2239-preparapedidos-2000-kg-yale", "2239"]
  ] as const) {
    assert.equal(gamUrlYear(other[0], other[1]), null, other[0]);
  }
});


test("GAM: año con procedencia URL exige un segmento de año, nunca una capacidad en kilos", () => {
  for (const [reference, suffix] of [
    ["2240", "preparapedidos-2000-k-yale-mo25"],
    ["2241", "preparapedidos-2000-k-yale-mo10s"],
    ["236", "transpaleta-manual-2000-kg-logitrans-panther-silent"]
  ] as const) {
    const record = { providerId: "gam", reference,
      url: `https://online.gamrentals.com/es/yale/${reference}-${suffix}`,
      title: "Preparapedidos 2000 kg", year: "2000", yearSource: "url" as const };
    assert.equal(gamSourceYear(record), null, reference);
  }
  const valid = { providerId: "gam", reference: "6588",
    url: "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6588-2019-yale-mo20p",
    title: "Equipo de segunda mano", year: "2019", yearSource: "url" as const };
  assert.equal(gamSourceYear(valid), "2019");
  assert.equal(gamSourceYear({ ...valid, year: "2000" }), null);
  assert.equal(gamSourceYear({ ...valid, url: valid.url.replace("online.gamrentals.com", "example.com") }), null);
  assert.equal(gamSourceYear({ ...valid, providerId: "gomariz" }), "2019");
});
