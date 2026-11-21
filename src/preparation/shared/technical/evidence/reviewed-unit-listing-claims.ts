import type { ProductRecord } from "../../../../contracts/catalog.js";
import { createHash } from "node:crypto";
import { matchesTechnicalUnitListingVerification, technicalUnitListingClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { TechnicalDocumentReference, TechnicalDocumentVerification } from "../../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../../catalog/identity-fingerprint.js";

type ListingFact = {
  readonly field: string;
  readonly value: string;
  readonly support: string;
};

type ReviewedListing = {
  readonly reference: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly url: string;
  readonly facts: readonly ListingFact[];
};

const listings: readonly ReviewedListing[] = [
  {
    reference: "6993", fingerprint: "43d1ac5dc31e66b7fe7db2642dd502d244b8511af819535c195db88bb8a18f6e", title: "Lote 16",
    url: "https://online.gamrentals.com/es/lotes/6993-lote-16", facts: [
      { field: "JLG E300AJP · Altura de elevación anunciada", value: "11 m", support: "2007 JLG E300AJP, referencia PV-41592: Altura de elevación 11 metros y capacidad de carga 230 kg" },
      { field: "JLG E300AJP · Capacidad de cesta", value: "230 kg", support: "2007 JLG E300AJP, referencia PV-41592: capacidad de carga 230 kg" },
      { field: "Haulotte Optimum 8 · Altura de elevación anunciada", value: "8 m", support: "2007 HAULOTTE OPTIMUM 8, referencia VI-31059: Altura de elevación 8 metros y capacidad de carga 230 Kg" },
      { field: "Haulotte Optimum 8 · Capacidad de plataforma", value: "230 kg", support: "2007 HAULOTTE OPTIMUM 8, referencia VI-31059: capacidad de carga 230 Kg" }
    ]
  },
  {
    reference: "6994", fingerprint: "ad109b9cf172f19df91bfa8da442c0442c0b342a9a78754503383177e284342a", title: "Lote 17",
    url: "https://online.gamrentals.com/es/lotes/6994-lote-17", facts: [
      { field: "Yale ERP16VT MWB · Altura de elevación anunciada", value: "5.500 mm", support: "2016 YALE ERP16VT MWB, referencia GAM-28543: Altura de elevación 5,5 metros" },
      { field: "Yale ERP16VT MWB · Capacidad de carga", value: "1.600 kg", support: "2016 YALE ERP16VT MWB, referencia GAM-28543: capacidad de carga 1600 Kg" }
    ]
  },
  {
    reference: "6995", fingerprint: "12c185632d1c6242bb166714b7c7e064b4a0af7bb77a9bccf4b2693fe123b06b", title: "Lote 18",
    url: "https://online.gamrentals.com/es/lotes/6995-lote-18", facts: [
      { field: "Hyster S1.2 · Altura de elevación anunciada", value: "3.500 mm", support: "2021 HYSTER S1.2, referencia GAM-20716: Altura de elevación 3,5 metros" },
      { field: "Hyster S1.2 · Capacidad de carga", value: "1.200 kg", support: "2021 HYSTER S1.2, referencia GAM-20716: capacidad de carga 1200 Kg" },
      { field: "Yale ERP18VT MWB · Capacidad de carga", value: "1.800 kg", support: "2018 YALE ERP18VT MWB, referencia GAM-28594: capacidad de carga 1800 Kg" },
      { field: "Yale ERP18VT MWB · Tipo de carretilla", value: "Eléctrica triciclo", support: "2018 YALE ERP18VT MWB, referencia GAM-28594: Carretilla frontal eléctrica triciclo" }
    ]
  },
  {
    reference: "6806", fingerprint: "7c79787664bc2ce62bbd7c3eab7efa2364e00af10496742d461edf4f7718355b",
    title: "Musoshi PoP Up Mini", url: "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini",
    facts: [
      { field: "Potencia de motor publicada para la unidad", value: "15,6 kW", support: "Referencia INQ-04323, P1.6, serie NRXL3AALS10000101, año 2024: el anuncio muestra Potencia Motor 15,6 KW; cotejada con el inventario Inquieto de la misma unidad" },
      { field: "Sistema de frenos anunciado", value: "Disco delantero y tambor trasero", support: "Referencia INQ-04323, serie NRXL3AALS10000101: la sección Características técnicas de GAM afirma Sistema de frenos: disco delantero y tambor trasero" },
      { field: "Tipo de motor anunciado", value: "Eléctrico sin escobillas", support: "Referencia INQ-04323, serie NRXL3AALS10000101: la sección Características técnicas de GAM afirma Motor: eléctrico brushless" }
    ]
  }
];

export const reviewedUnitListingVerification = (
  original: ProductRecord, document: TechnicalDocumentReference, field: string, value: string
): TechnicalDocumentVerification | null => {
  if (original.providerId !== "gam" || original.url !== document.url ||
    document.brand !== original.brand || document.model !== original.model) return null;
  const fingerprint = originalRecordFingerprint(original);
  const originalJsonSha256 = createHash("sha256").update(JSON.stringify(original)).digest("hex");
  const matches = listings.filter((listing) => listing.reference === original.reference &&
    listing.fingerprint === originalJsonSha256 && listing.title === original.title && listing.url === original.url)
    .flatMap((listing) => listing.facts.filter((fact) => fact.field === field && fact.value === value));
  if (matches.length > 1) throw new Error("Acreditación de anuncio de lote repetida");
  const fact = matches[0];
  if (!fact) return null;
  const verification: TechnicalDocumentVerification = {
    kind: "reviewed-unit-listing", reviewedOn: "2026-11-21", support: fact.support,
    claimSha256: technicalUnitListingClaimSha256(document, fingerprint, field, value, "2026-11-21", fact.support)
  };
  return matchesTechnicalUnitListingVerification(document, fingerprint, field, value, verification)
    ? verification : null;
};
