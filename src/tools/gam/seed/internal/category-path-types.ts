export type ProductCondition = "Segunda_Mano" | "Nuevo" | "Alquiler";

export type SeedProduct = {
    id: number;
    title: string;
    categorySellID: number;
    companyID: number;
    condition: ProductCondition;
    description_title: string;
    description: string;
    image: string;
    reference: string;
    description_general: string;
    spec: Record<string, string | number | boolean>;
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
    idStart: number;
    companyID: number;
    defaultImage: string;
    categorySellFlatJsonPath: string;
    categorySellPathByCategoryKey?: Readonly<Record<string, string>>;
    metadataByCategoryKey?: Readonly<
        Record<
            string,
            {
                keywords: string[];
                tags: string[];
            }
        >
    >;
    referencePrefix?: string;
};

