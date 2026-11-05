import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const byReference = new Map(gam.products.map((record) => [record.reference, record]));

const commercialIdentities = [
  { reference: "2020", technicalModel: "E2.2XN", commercialModel: "E2.0XN", context: "2.000 kg" },
  { reference: "2170", technicalModel: "H9XD-ECD7", commercialModel: "H9XD-EC7", context: "contenedores" },
  { reference: "2171", technicalModel: "H9XD-ECD8", commercialModel: "H9XD-EC8", context: "contenedores" },
  { reference: "2180", technicalModel: "S1.6SSL", commercialModel: "S1.6 SL", context: "patas abiertas" },
  { reference: "2294", technicalModel: "ERP35VL (LWB)", commercialModel: "ERP35VL", context: "batalla larga (LWB)" },
  { reference: "2300", technicalModel: "MC12 (pedestrian)", commercialModel: "MC12", context: "conducción a pie" },
  { reference: "2301", technicalModel: "MC15 (pedestrian)", commercialModel: "MC15", context: "conducción a pie" },
  { reference: "3132", technicalModel: "H4.0UT", commercialModel: "H4.5UT", context: "diésel" },
  { reference: "4029", technicalModel: "BCS S16H Descarga alto", commercialModel: "BCS S16H", context: "descarga alta" },
  { reference: "4736", technicalModel: "XG0807AC-LI", commercialModel: "XG0807ACW", context: "batería de litio" },
  { reference: "4750", technicalModel: "XG1523ERT", commercialModel: "XG1523RT", context: "Kubota V2403" },
  { reference: "4751", technicalModel: "XG1523RT", commercialModel: "XG1823RT", context: "18,1 metros" },
  { reference: "4752", technicalModel: "XGA12ACK", commercialModel: "XGA12K", context: "articulada diésel" },
  { reference: "4792", technicalModel: "XGS58E1", commercialModel: "XGS58E", context: "58,6 metros" },
  { reference: "6689", technicalModel: "6 CABRIO 80 2", commercialModel: "80 2,6 CABRIO", context: "171.860 km" }
] as const;

for (const { reference, technicalModel, commercialModel, context } of commercialIdentities) {
  test(`GAM ${reference}: conserva la identificación comercial acreditada frente al literal técnico`, () => {
    const record = byReference.get(reference);
    assert.ok(record, reference);
    const original = JSON.stringify(record);
    assert.equal(record.model, technicalModel);
    assert.equal(record.specs?.Modelo, technicalModel);
    assert.ok(record.title?.toLocaleLowerCase("es").includes(commercialModel.toLocaleLowerCase("es")), reference);
    assert.ok(record.url.includes(`/${reference}-`), reference);

    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    if (["2020", "2170", "2171", "3132"].includes(reference)) {
      assert.equal(prepared.product.spec.Modelo, commercialModel, reference);
    }
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    const general = prepared.product.description_general?.toLocaleLowerCase("es") ?? "";
    assert.ok(general.includes(commercialModel.toLocaleLowerCase("es")), reference);
    assert.ok(general.includes(context.toLocaleLowerCase("es")), reference);
    if (reference === "4029") {
      assert.ok(record.longDescription?.includes("BCS S16L"), reference);
      assert.ok(general.includes("s16l") && general.includes("no se debe trasladar"), reference);
    } else if (reference === "6689") {
      assert.equal(record.specs?.["Matrícula"], "4909-GJP");
      assert.equal(record.specs?.Kilómetros, "171860 KM");
    } else {
      assert.ok(record.longDescription?.toLocaleLowerCase("es").includes(commercialModel.toLocaleLowerCase("es")), reference);
    }
    assert.equal(JSON.stringify(record), original, reference);
  });
}
