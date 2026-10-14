// The page's clock against the sponsor's: both must name the same epoch, or
// the page would show a survey as open that the sponsor refuses.

import assert from "node:assert/strict";
import { test } from "node:test";

import { epochAt, epochEnd, transactionUrl } from "../network.js";
import { epochAt as sponsorEpochAt } from "../sponsor.js";

const HOUR = 3_600_000;

test("the same epochs as the sponsor", () => {
  const from = Date.UTC(2026, 9, 1);
  for (const network of ["preview", "preprod", "mainnet"]) {
    // Two months, every hour and around each: epochs change on the hour.
    for (let time = from; time < from + 61 * 24 * HOUR; time += HOUR) {
      for (const t of [time - 1, time, time + 1000]) {
        assert.equal(epochAt(network, t), sponsorEpochAt(network, t), `${network} at ${new Date(t).toISOString()}`);
      }
    }
  }
});

test("an epoch ends where the next one starts", () => {
  for (const [network, epoch] of [["preview", 1530], ["preprod", 250], ["mainnet", 590]]) {
    const end = epochEnd(network, epoch);
    assert.equal(epochAt(network, end - 1), epoch);
    assert.equal(epochAt(network, end), epoch + 1);
  }
});

test("explorer links", () => {
  assert.equal(transactionUrl("preview", "ab12"), "https://preview.cardanoscan.io/transaction/ab12");
  assert.equal(transactionUrl("mainnet", "ab12"), "https://cardanoscan.io/transaction/ab12");
  assert.throws(() => transactionUrl("testnet", "ab12"), /unknown network/);
});
