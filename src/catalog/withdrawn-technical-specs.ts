const verifiedWithdrawals = [
  { providerId: "gam", reference: "6994", sourceUrl: "https://online.gamrentals.com/es/lotes/6994-lote-17",
    model: null, field: "Yale MP16 · Ancho exterior de horquillas", value: "680 mm",
    reason: "Configuración no acreditada; documentación contradictoria de 670/680 mm" },
  { providerId: "mercaeleva", reference: "M690-5522",
    sourceUrl: "https://sales.mercaeleva.com/es/for-sale/machine/Genie-Z-34-22-M690-5522",
    model: "Z-34/22", field: "Anchura de plataforma", value: "1,42 m",
    reason: "Ancho de cesta opcional; configuración instalada no acreditada" },
  { providerId: "mercaeleva", reference: "M879-4639",
    sourceUrl: "https://sales.mercaeleva.com/es/for-sale/machine/Stocklin-EDP-2000-M879-4639",
    model: "EDP-2000", field: "Centro de carga", value: "600 mm",
    reason: "Documentos de variantes relacionadas sin identidad inequívoca" }
] as const;

export const withdrawnTechnicalSpecs = verifiedWithdrawals.map(({ providerId, reference, field, value, reason }) =>
  ({ providerId, reference, field, value, reason }));

export const withdrawnTechnicalSpecIdentities = verifiedWithdrawals;
