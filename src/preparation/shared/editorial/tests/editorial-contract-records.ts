import type { ProductRecord } from "../../../../contracts/catalog.js";

const basis: ProductRecord = {
  providerId: "gomariz",
  categoryKey: "venta",
  categoryName: "Venta de maquinaria",
  url: "https://www.gomarizrent.com/producto/marca-modelo10/",
  title: "Plataforma de tijera eléctrica MARCA MODELO10",
  shortDescription: null,
  longDescription: null,
  price: null,
  condition: "Segunda mano",
  reference: "CONTROL-01",
  brand: "MARCA",
  model: "MODELO10",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: { "Altura de trabajo": "10 m", Capacidad: "450 kg", Motor: "Eléctrico" }
};

export const controlledGomarizPlatform = (): ProductRecord => ({ ...basis, specs: { ...basis.specs } });

export const controlledMercaelevaPlatform = (): ProductRecord => ({
  ...basis,
  providerId: "mercaeleva",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/equipo-CONTROL-02",
  reference: "CONTROL-02",
  specs: { "Altura de trabajo": "10 m", "Tipo de motor": "Eléctrico" }
});

export const controlledGamForklift = (): ProductRecord => ({
  ...basis,
  providerId: "gam",
  url: "https://online.gamrentals.com/es/carretillas/CONTROL-03-carretilla-elevadora",
  reference: "CONTROL-03",
  title: "Carretilla elevadora MARCA MODELO10 2500 kg",
  specs: { "Capacidad de carga (kg)": "2500 kg", "Altura de elevación (mm)": "4500 mm" }
});

export const controlledGomarizForklift = (): ProductRecord => ({
  ...basis,
  title: "Carretilla elevadora MARCA MODELO10 2500 kg",
  specs: { Capacidad: "2500 kg", "Altura máxima de elevación": "4,5 m" }
});

export const controlledMercaelevaForklift = (): ProductRecord => ({
  ...basis,
  providerId: "mercaeleva",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/equipo-CONTROL-04",
  reference: "CONTROL-04",
  title: "Carretilla elevadora MARCA MODELO10 2500 kg",
  specs: { "Capacidad máxima de elevación": "2500 kg" }
});
