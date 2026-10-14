// What a page needs to know of a Cardano network without reading the chain:
// the current epoch, from the clock, and where its transactions can be seen.
//
// No dependency: the survey site and the preview page use this module. The
// sponsor has its own `epochAt`, from the SDK's constants; a test checks that
// both agree.

// The time (s) and the epoch from which epochs have a fixed length (s).
const NETWORKS = {
  preview: { start: 1_666_656_000, epoch: 0, epochLength: 86_400, explorer: "https://preview.cardanoscan.io" },
  preprod: { start: 1_655_769_600, epoch: 4, epochLength: 432_000, explorer: "https://preprod.cardanoscan.io" },
  mainnet: { start: 1_596_059_091, epoch: 208, epochLength: 432_000, explorer: "https://cardanoscan.io" },
};

/** The epoch at a time (ms). */
export function epochAt(network, time = Date.now()) {
  const { start, epoch, epochLength } = networkOf(network);
  return epoch + Math.floor((time / 1000 - start) / epochLength);
}

/** When an epoch ends (ms): a survey takes responses until the end of its end epoch. */
export function epochEnd(network, epoch) {
  const { start, epoch: first, epochLength } = networkOf(network);
  return (start + (epoch + 1 - first) * epochLength) * 1000;
}

/** The page of a transaction in an explorer. */
export function transactionUrl(network, txId) {
  return `${networkOf(network).explorer}/transaction/${txId}`;
}

function networkOf(network) {
  if (!Object.hasOwn(NETWORKS, network)) throw new Error(`unknown network ${network}`);
  return NETWORKS[network];
}
