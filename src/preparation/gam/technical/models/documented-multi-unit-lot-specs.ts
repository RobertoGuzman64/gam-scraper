import { applyDocumentedTechnicalEvidence } from "../../../shared/technical/evidence/documented-technical-evidence.js";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

type DocumentedUnit = {
  readonly fingerprint: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly title: string;
  readonly url: string;
  readonly categoryKey: string;
  readonly sources: readonly string[];
  readonly specifications: Readonly<SpecsMap>;
};

const documentedUnits: Readonly<Record<string, DocumentedUnit>> = {
  "6971": {
    "sources": [
      "https://online.gamrentals.com/en/884-lotes",
      "https://machineryline.es/-/venta/carretillas-electricas/UniCarriers/1Q2L25Q--25090213332743096600",
      "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6738-2016-unicarriers-a1n1l18q-"
    ],
    "specifications": {
      "UniCarriers 1Q2L25Q · Capacidad de carga": "2.500 kg",
      "UniCarriers 1Q2L25Q · Altura de elevación": "4.750 mm",
      "UniCarriers A1N1L18Q · Capacidad de carga": "1.800 kg",
      "UniCarriers A1N1L18Q · Altura de elevación": "4.750 mm"
    },
    "fingerprint": "91fa409ae0f12b5ed2a9b160e3da1632e715b9cdbdf58d7ff03563080d3e0880",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 11",
    "url": "https://online.gamrentals.com/es/lotes/6971-lote-11"
  },
  "6987": {
    "sources": [
      "https://online.gamrentals.com/en/884-lotes",
      "https://online.gamrentals.com/en/electric-pallets/5827-2017-yale-mp20",
      "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/5937-2021-hyster-p20sd"
    ],
    "specifications": {
      "Yale MP20 · Capacidad de carga": "2.000 kg",
      "Yale MP20 · Longitud de horquillas": "1.156 mm",
      "Hyster P2.0SD · Capacidad de carga": "2.000 kg",
      "Hyster P2.0SD · Altura de elevación": "1.600 mm"
    },
    "fingerprint": "dbd0e433068d879dd758e374506fba0a3e2c05ef898a8867bd3c56b5182df537",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 12",
    "url": "https://online.gamrentals.com/es/lotes/6987-lote-12"
  },
  "6988": {
    "sources": [
      "https://online.gamrentals.com/en/884-lotes",
      "https://online.gamrentals.com/cl/transpaletas-electricas-segunda-mano/6436-2022-hyster-p20",
      "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6860-2015-still-rx-60-35"
    ],
    "specifications": {
      "Hyster P2.0 · Capacidad de carga": "2.000 kg",
      "Hyster P2.0 · Altura de elevación": "220 mm",
      "Still RX 60-35 · Capacidad de carga": "3.500 kg",
      "Still RX 60-35 · Altura de elevación": "4.500 mm"
    },
    "fingerprint": "40be27579ce7dc2c645c2a4d7643e6112b13302161b84ff644b8a79531e47cda",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 13",
    "url": "https://online.gamrentals.com/es/lotes/6988-lote-13"
  },
  "6989": {
    "sources": [
      "https://online.gamrentals.com/en/884-lotes",
      "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5792-2006-toyota-lpe200-",
      "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6835-2019-yale-erp35vl"
    ],
    "specifications": {
      "Toyota LPE200 · Capacidad de carga": "2.000 kg",
      "Toyota LPE200 · Longitud de horquillas": "1.150 mm",
      "Yale ERP35VL · Capacidad de carga": "3.500 kg",
      "Yale ERP35VL · Altura de elevación": "4.100 mm"
    },
    "fingerprint": "48b5058cae94fe0dbbee2794a9e0b5ac1a75cbfdb42a0c1bb68e3b1cc5b8f8b0",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "lote 14",
    "url": "https://online.gamrentals.com/es/lotes/6989-lote-14"
  },
  "6993": {
    "sources": [
      "https://online.gamrentals.com/es/lotes/6993-lote-16"
    ],
    "specifications": {
      "JLG E300AJP · Altura de elevación anunciada": "11 m",
      "JLG E300AJP · Capacidad de cesta": "230 kg",
      "Haulotte Optimum 8 · Altura de elevación anunciada": "8 m",
      "Haulotte Optimum 8 · Capacidad de plataforma": "230 kg"
    },
    "fingerprint": "43d1ac5dc31e66b7fe7db2642dd502d244b8511af819535c195db88bb8a18f6e",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 16",
    "url": "https://online.gamrentals.com/es/lotes/6993-lote-16"
  },
  "6994": {
    "sources": [
      "https://online.gamrentals.com/es/lotes/6994-lote-17",
      "https://www.yale.com/es-es/emea/carretillas-elevadoras-electricas-de-3-ruedas/erp15-20vt/"
    ],
    "specifications": {
      "Yale ERP16VT MWB · Capacidad de carga": "1.600 kg",
      "Yale ERP16VT MWB · Altura de elevación anunciada": "5.500 mm",
      "Yale MP16 · Ancho exterior de horquillas": "680 mm",
      "Yale MP16 · Accionamiento": "Eléctrico"
    },
    "fingerprint": "ad109b9cf172f19df91bfa8da442c0442c0b342a9a78754503383177e284342a",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 17",
    "url": "https://online.gamrentals.com/es/lotes/6994-lote-17"
  },
  "6995": {
    "sources": [
      "https://online.gamrentals.com/es/lotes/6995-lote-18",
      "https://www.yale.com/es-es/emea/carretillas-elevadoras-electricas-de-3-ruedas/erp15-20vt/"
    ],
    "specifications": {
      "Hyster S1.2 · Capacidad de carga": "1.200 kg",
      "Hyster S1.2 · Altura de elevación anunciada": "3.500 mm",
      "Yale ERP18VT MWB · Capacidad de carga": "1.800 kg",
      "Yale ERP18VT MWB · Tipo de carretilla": "Eléctrica triciclo"
    },
    "fingerprint": "12c185632d1c6242bb166714b7c7e064b4a0af7bb77a9bccf4b2693fe123b06b",
    "brand": null,
    "model": null,
    "categoryKey": "maquinaria",
    "title": "Lote 18",
    "url": "https://online.gamrentals.com/es/lotes/6995-lote-18"
  }
};

export const recoverGamDocumentedMultiUnitLotSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  applyDocumentedTechnicalEvidence(record, specs, documentedUnits, { providerId: "gam", isEligible: (value) => value.url.startsWith("https://online.gamrentals.com/"), exactTitleAndUrl: true });
