import assert from "node:assert/strict";
import test from "node:test";
import { explicitGamTitleYear, gamUrlYear } from "../year.js";

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
