import type { OfflinePreparation } from "../import/preparation/offline-document.js";

export type Snapshot = Readonly<Record<string, { readonly sha256: string; readonly count: number }>>;

export const cohorts: readonly Snapshot[] = [
  {
    gam: { sha256: "945e218ad93782e868a50b8ecaad99e225242274d9a32ed7b8203cb426e6af87", count: 1008 },
    gomariz: { sha256: "37642de1041aafebafd274eac0bb8a2338d4bebb3adeee349cdd6a480d08cbb6", count: 143 },
    mercaeleva: { sha256: "335c1d5474dfb796125802f925f142218bf8b86ac038d608e801774ebabe8810", count: 218 }
  },
  {
    gam: { sha256: "7f31ebee51f573401d6f20bbe850751c46ff1659a5a91ffcf4302e82ed11e11d", count: 1004 },
    gomariz: { sha256: "13a889861d03a86c4756d85e65f894b44c5097bcfbcb84d096c67786d0513e90", count: 143 },
    mercaeleva: { sha256: "a0343988c4ebb46d10d87ec5d739f2d12364c6f29a74424b35140e2418fb591a", count: 218 }
  }
];

export const isNewEditorialCohort = (preparations: readonly OfflinePreparation[]): boolean =>
  preparations.some((item) => item.source.providerId === "gam" &&
    item.source.catalogSha256 === cohorts[1]?.gam?.sha256);


