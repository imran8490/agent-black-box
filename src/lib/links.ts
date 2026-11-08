// Client-safe link helpers.

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK ?? "mainnet";
const AGGREGATOR =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  `https://aggregator.walrus-${NETWORK === "mainnet" ? "mainnet" : "testnet"}.walrus.space`;

export const suiscanTx = (digest: string) => `https://suiscan.xyz/${NETWORK}/tx/${digest}`;
export const walrusBlobUrl = (blobId: string) => `${AGGREGATOR}/v1/blobs/${blobId}`;

export const formatSui = (mist: string): string => {
  const n = Number(mist) / 1e9;
  if (n === 0) return "0 SUI";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 9 })} SUI`;
};
