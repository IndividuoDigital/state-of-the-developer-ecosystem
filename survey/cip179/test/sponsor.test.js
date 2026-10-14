// The sponsor's clock: epochs from the time, without reading the chain's tip.

import assert from "node:assert/strict";
import { test } from "node:test";

import { epochAt } from "../sponsor.js";

test("epochs from the time", () => {
  const preview = Date.UTC(2022, 9, 25); // slot 0
  assert.equal(epochAt("preview", preview), 0);
  assert.equal(epochAt("preview", preview + 1100 * 86_400_000 - 1), 1099);
  assert.equal(epochAt("preview", preview + 1100 * 86_400_000), 1100);

  const shelley = 1_596_059_091_000; // mainnet slot 4492800, epoch 208
  assert.equal(epochAt("mainnet", shelley), 208);
  assert.equal(epochAt("mainnet", shelley + 432_000_000 - 1), 208);
  assert.equal(epochAt("mainnet", shelley + 292 * 432_000_000), 500);

  const preprod = Date.UTC(2022, 5, 21); // slot 86400, epoch 4
  assert.equal(epochAt("preprod", preprod), 4);
  assert.equal(epochAt("preprod", preprod + 432_000_000 - 1), 4);
  assert.equal(epochAt("preprod", preprod + 246 * 432_000_000), 250);
});
