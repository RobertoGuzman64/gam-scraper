import type { ImportCandidate } from "../import/preparation/contracts.js";
import type { OfflinePreparation, PreparationSource } from "../import/preparation/offline-document.js";

type EditorialExclusion = {
  readonly providerId: string;
  readonly reference: string;
  readonly sourceUrl: string;
  readonly reason: string;
  readonly evidenceUrls: readonly string[];
  readonly requiredIssues: readonly string[];
};

const snapshots: Readonly<Record<string, { readonly sha256: string; readonly count: number }>> = {
  gam: { sha256: "945e218ad93782e868a50b8ecaad99e225242274d9a32ed7b8203cb426e6af87", count: 1008 },
  gomariz: { sha256: "37642de1041aafebafd274eac0bb8a2338d4bebb3adeee349cdd6a480d08cbb6", count: 143 },
  mercaeleva: { sha256: "335c1d5474dfb796125802f925f142218bf8b86ac038d608e801774ebabe8810", count: 218 }
};

const exclusions: readonly EditorialExclusion[] = [
  {
    providerId: "gam", reference: "6682",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6682-2020-hyster-h35ft",
    reason: "No publicable hasta acreditar la identidad física y la titularidad del número de serie compartido con GAM-11594; el stock GAM-11596 y el horómetro distintos no demuestran dos unidades independientes",
    evidenceUrls: [
      "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6682-2020-hyster-h35ft",
      "https://www.machineryzone.es/usado/carretilla-elevadora-gas/47102132/hyster-h3-5ft.html"
    ],
    requiredIssues: ["Número de serie P177B10585U compartido", "Stock GAM diferenciado"]
  },
  {
    providerId: "gam", reference: "6703",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6703-2020-hyster-h35ft",
    reason: "No publicable hasta acreditar la identidad física y la titularidad del número de serie compartido con GAM-11596; no consolidar ni asignar el VIN por suposición",
    evidenceUrls: [
      "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6703-2020-hyster-h35ft",
      "https://www.machineryzone.es/usado/carretilla-elevadora-gas/47102020/hyster-h3-5ft.html"
    ],
    requiredIssues: ["Número de serie P177B10585U compartido", "Stock GAM diferenciado"]
  },
  {
    providerId: "mercaeleva", reference: "M827-8304",
    sourceUrl: "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304",
    reason: "No publicable: la publicación MER0798 contradice la capacidad de carga (4800/3000 kg) y el mástil (dúplex/tríplex); requiere confirmación del equipo físico",
    evidenceUrls: [
      "https://sales.mercaeleva.com/es/for-sale/machine/Linde-E48P-M827-8304",
      "https://machineryline.info/-/sale/electric-forklifts/Linde/E48P-CARRETILLA-ELEVADORA-ELECTRICA-4800-KG--26071017125032650600"
    ],
    requiredIssues: ["Atributo contradictorio: Capacidad de carga", "Atributo contradictorio: Tipo de mástil", "MER0798:"]
  }
];

export type PublishableSelection = {
  readonly source: readonly PreparationSource[];
  readonly totals: {
    readonly original: number;
    readonly ready: number;
    readonly review: number;
    readonly publishable: number;
    readonly excluded: number;
  };
  readonly products: readonly ImportCandidate[];
  readonly exclusions: readonly {
    readonly providerId: string;
    readonly reference: string;
    readonly sourceUrl: string;
    readonly reason: string;
    readonly evidenceUrls: readonly string[];
    readonly issues: readonly string[];
  }[];
};

export const selectPublishableCatalog = (preparations: readonly OfflinePreparation[]): PublishableSelection => {
  const sources = new Set<string>();
  const identified = new Set<string>();
  const foundExclusions = new Set<string>();
  const publishable: ImportCandidate[] = [];
  const excluded: PublishableSelection["exclusions"][number][] = [];
  let ready = 0;
  let review = 0;

  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    const expected = snapshots[providerId];
    if (!expected || sources.has(providerId) || preparation.source.catalogSha256 !== expected.sha256 ||
      preparation.source.productCount !== expected.count || preparation.products.length !== expected.count ||
      preparation.totals.ready + preparation.totals.review !== expected.count) {
      throw new Error(`Selección editorial: cohorte desconocida o incompleta (${providerId})`);
    }
    sources.add(providerId);
    for (const entry of preparation.products) {
      const reference = entry.product.reference;
      const key = `${providerId}:${reference ?? ""}`;
      if (!reference || identified.has(key) || entry.product.providerId !== providerId) {
        throw new Error(`Selección editorial: referencia inválida o repetida (${key})`);
      }
      identified.add(key);
      const decision = exclusions.find((item) => item.providerId === providerId && item.reference === reference);
      if (entry.status === "ready") {
        ready += 1;
        if (entry.issues.length || decision) throw new Error(`Selección editorial: decisión caducada (${key})`);
        publishable.push(entry.product);
      } else {
        review += 1;
        if (!decision || entry.product.sourceUrl !== decision.sourceUrl ||
          !decision.requiredIssues.every((required) => entry.issues.some((issue) => issue.includes(required)))) {
          throw new Error(`Selección editorial: review sin exclusión acreditada (${key})`);
        }
        foundExclusions.add(key);
        excluded.push({
          providerId, reference, sourceUrl: entry.product.sourceUrl,
          reason: decision.reason, evidenceUrls: decision.evidenceUrls, issues: entry.issues
        });
      }
    }
  }
  if (sources.size !== Object.keys(snapshots).length ||
    exclusions.some((decision) => !foundExclusions.has(`${decision.providerId}:${decision.reference}`))) {
    throw new Error("Selección editorial: faltan proveedores o exclusiones justificadas");
  }
  const original = preparations.reduce((count, preparation) => count + preparation.source.productCount, 0);
  if (original !== ready + review || publishable.length !== ready || excluded.length !== review) {
    throw new Error("Selección editorial: referencias no reconciliadas");
  }
  return {
    source: preparations.map((preparation) => preparation.source),
    totals: { original, ready, review, publishable: publishable.length, excluded: excluded.length },
    products: publishable,
    exclusions: excluded
  };
};
