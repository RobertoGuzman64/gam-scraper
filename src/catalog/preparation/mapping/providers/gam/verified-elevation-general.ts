import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

type ElevationEditorialEvidence = { readonly source: string; readonly prepared: string };

const verified: Readonly<Record<string, ElevationEditorialEvidence>> = {
  "4731": { source: "d52e933852288efdcb0f9ab4c91c643be94312a2e63300565539b7b7b0a87ce9", prepared: "238200d4e40984ded229e3c3ce877cd98b7d67ea1d616c388640d32edbdd2978" },
  "4738": { source: "1423660ddd826417978a37339844905672b667524b17198a56222ed329356af0", prepared: "53ffae9342047663096772a9750c7c0dd99408e9c157c99b40e5385e605b0634" },
  "4740": { source: "75c2304bbdc8f5a0e824a85568c852f121fb6ce758fe4466f06f13c89993e990", prepared: "c4e9139194e11e149ed7a0d117a2f1cfbe70a310c2ecba031f5fec2081e5766f" },
  "4742": { source: "c76deee18d5fbee6d1b83f9d463a87b77d69f3e0e06a855b4a62dcf3ea02a763", prepared: "4ed684c19d9afecf6c1078d73aef9cd53b96aed7dc4786f4e4c8c1a6728891b0" },
  "4800": { source: "2932207da839a5befcef19829d31d7c6c6c04bad439c0fa977208bc6b788fa5b", prepared: "78b28600e25d03b73ec545b830102c8d470c571460b99f8b64214e3d37629ec6" },
  "4744": { source: "9323969b1cb2f69a549b01452caf5677d9efa37c29795abf0ef727f789703fe8", prepared: "91795c43dafa7383fc2b195400913271bc6baf30b708c92216a6f5f1199252e2" },
  "4803": { source: "6e3a03ebf48beb9e2f302625c0e821d7f8e719dba020e9ca7e244d2c42c117e3", prepared: "de6b685fba5c7c5c43814958f010e33c070954273d56b095297029007af71eff" },
  "4746": { source: "81398fb3ca7d8558d61dc7c1eb87025babcbc75c89a4424f13af728050490e18", prepared: "6d33dc424603c5b9a544f85d78473fc90151245f6c2f9633bd7779f48455ecaf" },
  "4805": { source: "165bf89e00be439c597999e6797905f89f3977912a18238278b769a2efeb49a4", prepared: "c003294d4160d3c794de373d51527d3f84f0cfde69f4c565a2bfd2e293acc502" },
  "4766": { source: "93f1e5443b516ee57357046a67d7121521434c14c19f3e57c9a807b8d3597052", prepared: "55c36de6898b6a8972a681f4a4e1085c5fd475b1067b3f00f7d94e07c36ef40d" },
  "4779": { source: "97be7fe049e984e74b72e11e493afd3be2162ebdb6268b1b1f6761349baf081e", prepared: "753389ace040040de36957dd348876485ebb95ac6dd34bb854bd56f1f113db49" },
  "4780": { source: "738ec947a31d590857e999544cd74ad0accda5f15d5a118051398960b3a51b1a", prepared: "c9b80c42097882db2f0686dd03c1a358770e36e456d67d6d683917b931346e4f" },
  "4772": { source: "01c0a8437e30c924f6a3b127e55a2e5a60b5f28d45565ffa2b3c94cefbbc4601", prepared: "74af070bf207a01cffd5db13b568e5dd614ecbe8cb3bb255c0d808ec4ebf2113" },
  "4777": { source: "7f2dfaf4dee364c392f9643feba9df680381434e745c8c16037c8a04508e3178", prepared: "94c7f1a8d007dff9da4997cd4895a760e9a40abd39c0ea2e097a7c828b76a399" },
  "4783": { source: "69ae961defe0a443af34048744919d0fe1759fc675eb2683ac7f9b42d2fe72c5", prepared: "89cd182ff5d4d20206bc69eff1eca7a5ae60893b559b67cc45540453191d9e1b" },
  "4785": { source: "acb4bbf5fbc8dd284ac1440c3c6ec34e427304b622f7cfe14c3feb8bc9f7f606", prepared: "71a0fcf8e8bc7c9e12b73a169d117ed5e6701d6309cbd60b9bc095614a473c0e" },
  "4787": { source: "689a518470b125efa6b6700244987248c9fb579122f734aa8b3010c70ed88f4e", prepared: "7b32e644350999e1e81ffba952daeca37a05e1bcfddcc161968380eb240f13cf" },
  "4791": { source: "59e73e10d04c0a10231b046cf164383947b415ed87d228b9842d5e8452e03314", prepared: "2351254e6451345364ebf7777921c7e00f21bf2f3f5063b2c434d4e6b9427111" },
  "4761": { source: "1774de98059e2bfd30db297d3ec765f53d09b4b6ae4321d51f80ea9af2428002", prepared: "394e431d2844b261fea3b3541d8bda2fad305da19c7f29ca149bd1e38eeec0ef" },
  "2155": { source: "fab517339463319129404c704639579cc6b9e6b4e8b20789d1b486d5daf67cee", prepared: "607bb888bf31235ae514c72f46b7500ee2331efaa2918bbbbd2e6da62079d7fd" }
};

const sourceSpecKeys = [
  "Marca", "Modelo", "Longitud", "Anchura", "Altura", "Peso",
  "Altura de elevación (m)", "Capacidad de carga (kg)",
  "Tipo motor", "Tipo de batería", "Tracción 4x4",
  "Pendiente superable", "Dimensiones Cesta", "Capacidad de la batería",
  "Altura Plataforma", "Controles Hidraúlicos"
] as const;

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => hash(JSON.stringify([
  record.providerId, record.reference, record.url, record.title, record.brand,
  record.model, record.externalReference ?? null, record.condition, record.categoryKey,
  record.shortDescription, record.longDescription,
  ...sourceSpecKeys.map((key) => record.specs?.[key] ?? null)
]));

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const measurement = (value: string | undefined, unit: "mm" | "KG"): number | null => {
  const match = value ? /^(\d{1,6})\s*(mm|kg)$/i.exec(value) : null;
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const quantity = Number(match[1]);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
};

const elevation = (value: string | undefined): string | null => {
  const match = value ? /^(\d{1,2}(?:[.,]\d{1,2})?)\s*metros?$/i.exec(value) : null;
  return match?.[1]?.replace(".", ",") ?? null;
};

const specText = (record: ProductRecord, key: string): string | undefined => {
  const value = record.specs?.[key];
  return typeof value === "string" ? value : undefined;
};

const display = (quantity: number): string => String(quantity).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const summarize = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "elevacion-nueva" || !record.model || !record.brand ||
    !record.shortDescription || !record.title || !record.longDescription ||
    normalize(String(record.specs?.Marca ?? "")) !== normalize(record.brand) ||
    normalize(String(record.specs?.Modelo ?? "")) !== normalize(record.model) ||
    !normalize(record.title).includes(normalize(record.model)) ||
    !normalize(record.title).includes(normalize(record.brand)) ||
    !normalize(record.url.split("/").at(-1) ?? "").includes(normalize(record.model)) ||
    !normalize(record.shortDescription).includes(normalize(record.model)) ||
    !normalize(record.longDescription).includes(normalize(record.model))) return null;

  const height = elevation(specText(record, "Altura de elevación (m)"));
  const load = measurement(specText(record, "Capacidad de carga (kg)"), "KG");
  const length = measurement(specText(record, "Longitud"), "mm");
  const width = measurement(specText(record, "Anchura"), "mm");
  const weight = measurement(specText(record, "Peso"), "KG");
  if (!height || load === null || load < 100 || load > 2000 ||
    length === null || width === null || length < width || weight === null) return null;

  const shortHeight = /de\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*metros?\s+de altura/i.exec(record.shortDescription);
  const shortLoad = /capacidad de la cesta\s+(\d{1,4})\s*kg/i.exec(record.shortDescription);
  if (!shortHeight?.[1] || !shortLoad?.[1] ||
    Number(shortHeight[1].replace(",", ".")) !== Number(height.replace(",", ".")) ||
    Number(shortLoad[1]) !== load) return null;

  const type = /tijera/i.test(record.title) ? "de tijera" :
    /articulad/i.test(record.title) ? "articulada" :
    /telesc[oó]pic/i.test(record.title) ? "telescópica" : "elevadora";
  const drive = /h[ií]brida/i.test(record.title) ? "híbrida" :
    /di[eé]sel/i.test(record.title) ? "diésel" :
    /el[eé]ctric/i.test(record.title) || record.specs?.["Tipo motor"] === "Eléctrico" ? "eléctrica" : "";
  const battery = specText(record, "Tipo de batería");
  if (battery && battery !== "Batería de plomo" && battery !== "Batería de litio") return null;
  const driveText = drive ? ` ${drive}` : "";
  const special = record.specs?.["Tracción 4x4"] === "Sí" && /4x4/i.test(record.title)
    ? " La ficha identifica tracción 4x4, sin que ello autorice elevar con la máquina en pendiente." : "";
  const batteryText = battery ? ` Se declara ${battery.toLocaleLowerCase("es")} para esta variante.` : "";

  return `La plataforma ${type}${driveText} ${record.brand} ${record.model} tiene una altura de elevación publicada de ${height} m ` +
    `y una capacidad nominal de cesta de ${display(load)} kg. ` +
    `Sus dimensiones de transporte indicadas son ${display(length)} mm de longitud y ${display(width)} mm de anchura, ` +
    `con un peso de ${display(weight)} kg.${batteryText}${special} ` +
    `Para planificar el acceso y la operación deben comprobarse el peso total de operarios y herramientas, ` +
    `la resistencia del suelo y los límites de inclinación establecidos en el manual de la unidad.`;
};

export const resolveGamVerifiedElevationGeneral = (
  record: ProductRecord, preparedGeneral: string | null
): string | null => {
  const evidence = record.reference ? verified[record.reference] : undefined;
  if (!evidence || !preparedGeneral || sourceDigest(record) !== evidence.source ||
    hash(preparedGeneral) !== evidence.prepared) return null;
  return summarize(record);
};
