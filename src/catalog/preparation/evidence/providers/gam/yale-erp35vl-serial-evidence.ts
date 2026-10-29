import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { findSerialNumberCollisions } from "../../../../identity-conflicts.js";

type SerialNumberCollision = ReturnType<typeof findSerialNumberCollisions>[number];

const serial = "A976B08243T";
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const shortDescriptionHash = "a85993c03e73a7003e32b38235e47500152996e342d330afa8d1a50c98a61621";
const longDescriptionHash = "cd8075a84d8d16f2385e78cbfcaa848932aa1cf69d6f5cac29e68fd6051556fb";

const accreditedSnapshots: Readonly<Record<"6835" | "6858", readonly { readonly stock: string; readonly imagesHash: string }[]>> = {
  "6835": [
    { stock: "GAM", imagesHash: "1651eba50da66f7562d86094e8d803565c409737bce0ca838a6a2b83dade1ca6" },
    { stock: "GAM 27262", imagesHash: "38974ac9698b3a19bae1ca4e4d2449cf262e074a1a42af8c53f83a076d5c301d" }
  ],
  "6858": [
    { stock: "GAM-27262", imagesHash: "0598754465cab3c1d54858ac6f851dac96868519087d06cea8a626b9d34af458" },
    { stock: "GAM-27262", imagesHash: "33dafdbaf317a76ff4fe6983f67918af46253cd324dd2b7e1b162bcf7705577b" }
  ]
};

const originalYale = (record: ProductRecord, reference: "6835" | "6858", specsHash: string): boolean =>
  record.providerId === "gam" && record.reference === reference &&
  record.url === `https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/${reference}-2019-yale-erp35vl` &&
  record.categoryKey === "manutencion" && record.condition === "Segunda mano" &&
  accreditedSnapshots[reference].some((snapshot) => record.externalReference === snapshot.stock &&
    digest(JSON.stringify(record.images)) === snapshot.imagesHash) &&
  record.title === "Carretilla elevadora eléctrica 3500 Kg YALE ERP35VL" &&
  record.brand === "YALE" && record.model === "ERP35VL" && record.year === "2019" &&
  record.serialNumber === serial && record.location === "TARRAGONA" && record.country === "ESPAÑA" &&
  record.price === "24600" && record.priceText === "24600" &&
  record.horometer === (reference === "6835" ? "1660 horas" : "1662 horas") &&
  record.image === record.images?.[0] &&
  record.specs?.["Marca"] === "YALE" &&
  record.specs?.["Modelo"] === "ERP35VL" && record.specs?.["Nº de serie"] === serial &&
  record.shortDescription !== null && record.longDescription !== null &&
  digest(record.shortDescription) === shortDescriptionHash &&
  digest(record.longDescription) === longDescriptionHash &&
  digest(JSON.stringify(record.specs)) === specsHash;

export const verifiedYaleErp35vlSerialOwner = (collision: SerialNumberCollision): ProductRecord | null => {
  if (collision.providerId !== "gam" || collision.serialNumber !== serial || collision.products.length !== 2) return null;
  const stale = collision.products.find((record) => record.reference === "6835");
  const verified = collision.products.find((record) => record.reference === "6858");
  return stale && verified &&
    originalYale(stale, "6835", "43278a8b7d17d09817e5dec7f8423907e0f2b9e49ae3b81f94181a34c6cdd207") &&
    originalYale(verified, "6858", "4487fd360e1277d759f228f367c8f153d1d8d9538e12ddb57fa1e74ffe9b8f42") ? verified : null;
};


export const verifiedYaleErp35vlPotentialRepublishedListing = (collision: SerialNumberCollision): ProductRecord | null => {
  if (verifiedYaleErp35vlSerialOwner(collision) === null) return null;
  return collision.products.find((record) => record.reference === "6835") ?? null;
};

export const verifiedYaleErp35vlCrossListing = (collision: SerialNumberCollision): boolean =>
  verifiedYaleErp35vlPotentialRepublishedListing(collision) !== null;
