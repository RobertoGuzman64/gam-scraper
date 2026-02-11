export type SpecValue = string | number | boolean | readonly number[];

export type SeedProduct = {
    id: number;
    title: string;
    categorySellID: number;
    companyID: number;
    condition: "Segunda_Mano";
    description_title: string;
    description: string;
    image: string;
    reference: string;
    description_general: string;
    spec: Record<string, SpecValue>;
    metadata: {
        featured: boolean;
        keywords: string[];
        tags: string[];
    };
};

export type CategoryFlatRow = {
    id: number;
    parentId: number | null;
    name: string;
    slug: string;
};

export type ConvertOptions = {
    inputCsvPath: string;
    outputTsPath: string;
    categorySellFlatJsonPath: string;
    idStart: number;
    companyID: number;
    defaultImage: string;
    referencePrefix?: string;
};

export type Report = {
    totalRows: number;
    totalProductsWritten: number;
    missingCategorySellId: Record<string, number>;
    ambiguousUrlSlug: Record<string, number>;
    usedFallbackToCategoryKey: Record<string, number>;
    usedDirectSlugMatch: Record<string, number>;
    usedNormalizedSlugMatch: Record<string, number>;
    usedAliasSlugMatch: Record<string, number>;
    usedFuzzySlugMatch: Record<string, number>;
    unknownUrlSlug: Record<string, number>;
};
