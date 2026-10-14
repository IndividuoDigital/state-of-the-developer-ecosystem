// The sponsor's clock: epochs from the time, without reading the chain's tip.
// And its refusals, as the page reads them.

import assert from "node:assert/strict";
import { test } from "node:test";

import { epochAt, reply, SponsorError } from "../sponsor.js";

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

test("a refusal has a code", async () => {
  const refusal = async (error) => {
    const res = await reply(async () => {
      throw error;
    });
    return { status: res.status, ...(await res.json()) };
  };
  assert.deepEqual(await refusal(new SponsorError("not hex")), { status: 400, error: "not hex", code: "invalid" });
  assert.deepEqual(await refusal(new SponsorError("busy", 503, "busy")), { status: 503, error: "busy", code: "busy" });
  assert.deepEqual(await refusal(Object.assign(new SponsorError("already", 409, "already"), { txId: "ab" })), {
    status: 409,
    error: "already",
    code: "already",
    txId: "ab",
  });
  assert.equal((await refusal(new SyntaxError("bad JSON"))).code, "invalid");
});
