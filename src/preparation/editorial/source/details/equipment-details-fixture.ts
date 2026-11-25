import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveSourcedOperationalSpecs } from "./editorial-sourced-operational-specs.js";

export const original = (family: string, specs: SpecsMap): ProductRecord => ({
  providerId: "manain",
  categoryKey: "venta",
  categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venta-${family}-marca-modelo/`,
  title: "MODELO",
  shortDescription: null,
  longDescription: null,
  price: null,
  condition: "Segunda mano",
  reference: "CONTROL-01",
  brand: "MARCA",
  model: "MODELO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: { Marca: "MARCA", Modelo: "MODELO", "Nueva o usada": "usada", ...specs }
});

export const compose = (source: ProductRecord, general: string, prepared: ProductRecord = source): string | null =>
  resolveSourcedOperationalSpecs(source, prepared, general, true);

export const operationalGeneral = "La ficha técnica de carretilla elevadora MARCA MODELO10 identifica una máquina para la manutención de mercancías en instalaciones logísticas. La selección del equipo exige comprobar la distribución de la carga y los recorridos disponibles. El ancho de los pasillos, la superficie de apoyo y las condiciones del recinto condicionan las maniobras con la unidad anunciada.";

export const operationalDescription = (claim: string): string =>
  `${operationalGeneral} ${claim} El anuncio describe el equipo para operaciones de movimiento interno de mercancías. La organización de las tareas debe tener en cuenta el espacio disponible para circular y la distribución de los puestos de trabajo dentro de las instalaciones, sin presuponer las condiciones específicas de una operación concreta.`;
