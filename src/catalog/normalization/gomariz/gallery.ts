export const gomarizImageReference = (image: string | null): string | null => {
  const path = image?.split(/[?#]/u, 1)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const match = /^([a-z]{1,5}\d{3,8})[-_]/iu.exec(name);
  return match?.[1]?.toUpperCase() ?? null;
};

export const excludeGomarizForeignCover = (
  images: readonly string[], reference: string | null
): readonly string[] => {
  if (!reference || images.length < 3) return images;
  const ownReference = reference.trim().toUpperCase();
  const refs = images.map(gomarizImageReference);
  if (!refs[0] || refs[0] === ownReference) return images;
  const ownImages = images.filter((_, index) => refs[index] === ownReference);
  if (ownImages.length < 2 || ownImages.length !== images.length - 1) return images;
  return ownImages;
};
