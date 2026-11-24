const folded = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

export const containsEditorialIdentity = (text: string, identity: string): boolean => {
  const token = folded(identity).replace(/[^a-z0-9]/gu, "");
  if (!token) return false;
  const pattern = [...token].join("[^a-z0-9]{0,3}");
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?![a-z0-9])`, "u").test(folded(text));
};

export const containsEditorialBrandModel = (text: string, brand: string, model: string): boolean =>
  containsEditorialIdentity(text, brand) && containsEditorialIdentity(text, model);
