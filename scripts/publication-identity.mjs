const fullSha = /^[a-f0-9]{64}$/;
const directoryName = /^[a-f0-9]{12,64}$/;

export const isPublicationDirectoryName = (name) => typeof name === "string" && directoryName.test(name);
export const isFullPublicationSha = (sha) => typeof sha === "string" && fullSha.test(sha);
export const matchesPublicationApproval = (alias, sha) =>
  isPublicationDirectoryName(alias) && isFullPublicationSha(sha) && sha.startsWith(alias);
