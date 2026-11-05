const token = (value: string): string => value.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLocaleLowerCase("es");

const oneEditApart = (left: string, right: string): boolean => {
  if (left === right || Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return edits + Number(i < left.length || j < right.length) === 1;
};

export const findBrandTypo = (title: string, brand: string): { readonly index: number; readonly length: number } | null => {
  if (/\s/u.test(brand) || brand.length < 6) return null;
  const matches = [...title.matchAll(/\p{L}{5,}/gu)].filter((item) => oneEditApart(token(item[0]), token(brand)));
  if (matches.length !== 1 || matches[0]?.index === undefined) return null;
  return { index: matches[0].index, length: matches[0][0].length };
};
