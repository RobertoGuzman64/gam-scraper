import type { SeedProduct } from "./types.js";

const isValidIdentifier = (key: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

const escapeTemplateLiteral = (s: string): string =>
    s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const formatKey = (key: string): string => (isValidIdentifier(key) ? key : JSON.stringify(key));

const formatValue = (value: unknown, indent: string): string => {
    if (value === null || value === undefined) return "null";

    if (typeof value === "string") return `\`${escapeTemplateLiteral(value)}\``;
    if (typeof value === "number" || typeof value === "boolean") return String(value);

    if (Array.isArray(value)) {
        const parts = value.map((v) => formatValue(v, indent));
        return `[${parts.join(", ")}]`;
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const entries = Object.entries(obj);

        if (entries.length === 0) return "{}";

        const innerIndent = `${indent}  `;
        const lines = entries.map(([k, v]) => `${innerIndent}${formatKey(k)}: ${formatValue(v, innerIndent)},`);
        return `{\n${lines.join("\n")}\n${indent}}`;
    }

    return `\`${escapeTemplateLiteral(String(value))}\``;
};

const formatProduct = (p: SeedProduct, indent: string): string => {
    const innerIndent = `${indent}  `;

    const entries: Array<[string, unknown]> = [
        ["id", p.id],
        ["title", p.title],
        ["categorySellID", p.categorySellID],
        ["companyID", p.companyID],
        ["condition", p.condition],
        ["description_title", p.description_title],
        ["description", p.description],
        ["image", p.image],
        ["reference", p.reference],
        ["description_general", p.description_general],
        ["spec", p.spec],
        ["metadata", p.metadata]
    ];

    const lines = entries.map(([k, v]) => {
        if (k === "condition" && v === "Segunda_Mano") return `${innerIndent}condition: ProductCondition.Segunda_Mano,`;
        return `${innerIndent}${formatKey(k)}: ${formatValue(v, innerIndent)},`;
    });

    return `${indent}{\n${lines.join("\n")}\n${indent}}`;
};

export const renderSeedTs = (products: readonly SeedProduct[]): string => {
    const body = products.map((p) => formatProduct(p, "  ")).join(",\n");

    return `import { ProductCondition } from "@prisma/client";

const products = [
${body}
] as const;

export default products;
`;
};