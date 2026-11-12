import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contracts = {
  "src/commercial/legacy-export/contracts.ts": {
    ImportCandidate: `{
      readonly providerId: string;
      readonly sourceUrl: string;
      readonly reference: string | null;
      readonly externalReference?: string | null;
      readonly title: string | null;
      readonly categorySellID: number | null;
      readonly category: string | null;
      readonly condition: "Nuevo" | "Segunda_Mano" | null;
      readonly price: number | null;
      readonly description_title: string | null;
      readonly description: string | null;
      readonly description_general: string | null;
      readonly image: string | null;
      readonly images: readonly string[];
      readonly spec: Readonly<Record<string, SpecValue>>;
      readonly attributes: readonly { readonly attributeID: number; readonly value: string | number | boolean }[];
    }`
  },
  "src/commercial/projection/export-projection.ts": {
    CommercialExportProduct: `ImportCandidate & {
      readonly logoID: number | null;
      readonly companyID?: number;
      readonly metadata: CommercialMetadata;
    }`,
    CommercialExportIssue: `{
      readonly identity: string;
      readonly reference: string | null;
      readonly sourceUrl: string;
      readonly reason: string;
    }`,
    CommercialExportPlan: `{
      readonly version: 1;
      readonly providerId: string;
      readonly publicationSha256: string;
      readonly environment: "develop" | "production" | null;
      readonly total: number;
      readonly products: readonly CommercialExportProduct[];
      readonly excluded: readonly CommercialExportIssue[];
      readonly exceptions: readonly CommercialExportIssue[];
      readonly summary: {
        readonly exported: number;
        readonly categorized: number;
        readonly pendingCategory: number;
        readonly excludedLots: number;
        readonly excludedTools: number;
        readonly excludedAccessories: number;
        readonly attributes: number;
        readonly withLogo: number;
        readonly withPrice: number;
        readonly withCompany: number;
      };
    }`
  },
  "src/commercial/projection/presentation-projection.ts": {
    CommercialMetadata: `{
      readonly tags: readonly string[];
      readonly keywords: readonly string[];
      readonly featured: false;
    }`
  },
  "src/commercial/export/commercial-export.ts": {
    CommercialDeliveryProduct: `Omit<CommercialExportProduct, "providerId" | "sourceUrl" | "externalReference">`,
    CommercialDeliverySource: `{
      readonly identity: string;
      readonly reference: string | null;
      readonly sourceUrl: string;
      readonly externalReference?: string | null;
    }`,
    CommercialDeliveryPlan: `Omit<CommercialExportPlan, "version" | "products"> & {
      readonly version: 2;
      readonly products: readonly CommercialDeliveryProduct[];
      readonly sources: readonly CommercialDeliverySource[];
    }`
  },
  "src/commercial/export/commercial-exception-accreditation.ts": {
    CommercialExceptionAccreditation: `{
      readonly field: "year" | "height";
      readonly fingerprint: string;
      readonly evidenceSha256: string;
      readonly bindingSha256: string;
    }`
  },
  "src/contracts/catalog.ts": {
    SpecScalar: `string | number | boolean`,
    SpecValue: `SpecScalar | readonly SpecScalar[]`
  }
};

const errors = [];
const sources = new Map();

const source = (file) => {
  if (!sources.has(file)) {
    const content = readFileSync(join(root, file), "utf8");
    const parsed = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (parsed.parseDiagnostics.length > 0) throw new Error(`TypeScript inválido en ${file}`);
    sources.set(file, parsed);
  }
  return sources.get(file);
};

const canonical = (node) => {
  if (ts.isTypeLiteralNode(node)) return `{${node.members.map((member) => {
    if (!ts.isPropertySignature(member) || !member.type) throw new Error("Firma de contrato no soportada");
    const name = member.name.getText();
    return `${name}${member.questionToken ? "?" : ""}:${canonical(member.type)}`;
  }).sort().join(";")}}`;
  if (ts.isUnionTypeNode(node)) return node.types.map(canonical).sort().join("|");
  if (ts.isIntersectionTypeNode(node)) return node.types.map(canonical).sort().join("&");
  if (ts.isArrayTypeNode(node)) return `${canonical(node.elementType)}[]`;
  if (ts.isTypeOperatorNode(node)) return `${ts.tokenToString(node.operator)} ${canonical(node.type)}`;
  if (ts.isParenthesizedTypeNode(node)) return canonical(node.type);
  if (ts.isTypeReferenceNode(node)) return `${node.typeName.getText()}${node.typeArguments?.length
    ? `<${node.typeArguments.map(canonical).join(",")}>` : ""}`;
  if (ts.isLiteralTypeNode(node)) return node.literal.getText();
  return node.getText().replace(/\s+/gu, "");
};

const expression = (node) => {
  if (!node) return null;
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
};
const members = (node) => node && ts.isObjectLiteralExpression(expression(node)) ? expression(node).properties : [];
const property = (node, name) => members(node).find((item) =>
  ts.isPropertyAssignment(item) && item.name.getText() === name);
const compact = (value) => value.replace(/\s+/gu, "");
const keys = (node) => members(node).map((item) => ts.isSpreadAssignment(item) ? `...${compact(item.expression.getText())}`
  : item.name?.getText() ?? "?").sort();
const match = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(label);
};
const exactKeys = (label, node, expected) => match(label, keys(node), expected.map(compact).sort());
const alias = (file, name) => source(file).statements.find((statement) =>
  ts.isTypeAliasDeclaration(statement) && statement.name.text === name);

for (const [file, entries] of Object.entries(contracts)) {
  for (const [name, declaration] of Object.entries(entries)) {
    const actual = alias(file, name);
    const expected = ts.createSourceFile("contract.ts", `type Protected = ${declaration};`, ts.ScriptTarget.Latest, true);
    if (!actual || canonical(actual.type) !== canonical(expected.statements[0].type)) {
      errors.push(`${file}: ${name}`);
    }
  }
}

const exportFile = "src/commercial/export/commercial-export.ts";
const exportSource = source(exportFile);
const delivery = exportSource.statements.flatMap((statement) => ts.isVariableStatement(statement)
  ? statement.declarationList.declarations : []).find((declaration) => declaration.name.getText() === "buildCommercialDeliveryPlan");
const plan = delivery && ts.isArrowFunction(delivery.initializer) ? expression(delivery.initializer.body) : null;
exactKeys("Estructura de la proyección comercial", plan, ["...plan", "version", "exceptions", "sources", "products"]);
if (property(plan, "version")?.initializer.getText() !== "2") errors.push("Versión de la proyección comercial");

const sourcesMap = property(plan, "sources")?.initializer;
const sourcesCallback = sourcesMap && ts.isCallExpression(sourcesMap) ? sourcesMap.arguments[0] : null;
const sourceObject = sourcesCallback && ts.isArrowFunction(sourcesCallback) ? expression(sourcesCallback.body) : null;
exactKeys("Campos de procedencia comercial", sourceObject, ["identity", "reference", "sourceUrl", "...(product.externalReference === undefined ? {} : { externalReference: product.externalReference })"]);
const identityProperty = property(sourceObject, "identity")?.initializer;
const identityCall = identityProperty && ts.isPropertyAccessExpression(identityProperty)
  && ts.isCallExpression(identityProperty.expression) ? identityProperty.expression : null;
const identityFields = identityCall?.arguments[0];
exactKeys("Campos de identidad comercial", identityFields, ["providerId", "reference", "serialNumber", "url"]);
if (sourcesMap?.expression.getText() !== "plan.products.map" ||
  identityCall?.expression.getText() !== "buildProductIdentity" ||
  identityProperty.name?.getText() !== "key" ||
  property(identityFields, "providerId")?.initializer.getText() !== "plan.providerId" ||
  property(identityFields, "reference")?.initializer.getText() !== "product.reference" ||
  property(identityFields, "serialNumber")?.initializer.getText() !== "null" ||
  property(identityFields, "url")?.initializer.getText() !== "product.sourceUrl" ||
  property(sourceObject, "reference")?.initializer.getText() !== "product.reference" ||
  property(sourceObject, "sourceUrl")?.initializer.getText() !== "product.sourceUrl") {
  errors.push("Identidad y referencias de procedencia");
}

const productsMap = property(plan, "products")?.initializer;
const productsCallback = productsMap && ts.isCallExpression(productsMap) ? productsMap.arguments[0] : null;
const productParameter = productsCallback && ts.isArrowFunction(productsCallback) ? productsCallback.parameters[0]?.name : null;
if (productsMap?.expression.getText() !== "plan.products.map" ||
  !productParameter || !ts.isObjectBindingPattern(productParameter) ||
  !ts.isIdentifier(productsCallback.body) ||
  !productParameter.elements.some((element) => element.dotDotDotToken &&
    element.name.getText() === productsCallback.body.text)) {
  errors.push("Separación de productos y procedencias");
} else {
  match("Campos retirados del producto comercial",
    productParameter.elements.filter((element) => !element.dotDotDotToken)
      .map((element) => (element.propertyName ?? element.name).getText()).sort(),
    ["providerId", "sourceUrl", "externalReference"].sort());
}

let manifestCall = null;
const findManifest = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText() === "manifest") manifestCall = node.initializer;
  ts.forEachChild(node, findManifest);
};
findManifest(exportSource);
const manifest = manifestCall && ts.isCallExpression(manifestCall) && ts.isCallExpression(manifestCall.arguments[1])
  ? manifestCall.arguments[1].arguments[0] : null;
if (!manifestCall || !ts.isCallExpression(manifestCall) ||
  manifestCall.arguments[0]?.text !== "commercial-manifest.json") {
  errors.push("Nombre del manifiesto comercial");
}
let providerFilename = false;
const findProviderFilename = (node) => {
  if (ts.isTemplateExpression(node) && node.head.text === "" && node.templateSpans.length === 1 &&
    node.templateSpans[0].expression.getText() === "plan.providerId" &&
    node.templateSpans[0].literal.text === "-commercial.json") providerFilename = true;
  ts.forEachChild(node, findProviderFilename);
};
findProviderFilename(exportSource);
if (!providerFilename) errors.push("Nombre de los archivos comerciales");
exactKeys("Campos del manifiesto", manifest,
  ["version", "environment", "taxonomySha256", "attributesSha256", "logosSha256", "companiesSha256", "providers"]);
if (property(manifest, "version")?.initializer.getText() !== "2") errors.push("Versión del manifiesto comercial");
const providersMap = property(manifest, "providers")?.initializer;
const providerCallback = providersMap && ts.isCallExpression(providersMap) ? providersMap.arguments[0] : null;
const providerReturn = providerCallback && ts.isArrowFunction(providerCallback) && ts.isBlock(providerCallback.body)
  ? providerCallback.body.statements.find((statement) => ts.isReturnStatement(statement)) : null;
const providerBody = providerReturn?.expression ?? null;
exactKeys("Campos del proveedor en el manifiesto", providerBody, [
  "providerId", "publicationSha256", "originalCount", "...plan.summary", "excluded", "exceptions", "file", "sha256", "bytes"
]);

const accreditationSource = source("src/commercial/export/commercial-exception-accreditation.ts");
let bindingValues = null;
const findBinding = (node) => {
  if (ts.isPropertyAssignment(node) && node.name.getText() === "bindingSha256" &&
    ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === "sha256" &&
    ts.isArrayLiteralExpression(node.initializer.arguments[0])) {
    bindingValues = node.initializer.arguments[0].elements.map((entry) => entry.getText());
  }
  ts.forEachChild(node, findBinding);
};
findBinding(accreditationSource);
match("Vinculación de las acreditaciones comerciales", bindingValues, [
  "providerId", "issue.identity", "issue.reference", "issue.sourceUrl", "issue.reason",
  "field", "recognition.fingerprint", "recognition.evidenceSha256", "product"
]);

const validationSource = source("src/commercial/validation/commercial-receiver-product.ts");
const allowedKeys = validationSource.statements.flatMap((statement) => ts.isVariableStatement(statement)
  ? statement.declarationList.declarations : []).find((declaration) => declaration.name.getText() === "allowedKeys")?.initializer;
const allowed = allowedKeys && ts.isNewExpression(allowedKeys) && allowedKeys.arguments?.[0] && ts.isArrayLiteralExpression(allowedKeys.arguments[0])
  ? allowedKeys.arguments[0].elements.map((element) => element.text).sort() : [];
match("Campos admitidos por la validación comercial", allowed, [
  "reference", "title", "categorySellID", "category", "condition", "price", "description_title",
  "description", "description_general", "image", "images", "spec", "attributes", "logoID", "companyID", "metadata"
].sort());

if (errors.length > 0) {
  for (const item of errors) console.error(`FAIL | Contrato comercial v2 alterado: ${item}`);
  process.exitCode = 1;
} else {
  console.log("PASS | Contrato comercial v2 intacto (campos, tipos y procedencias)");
}
