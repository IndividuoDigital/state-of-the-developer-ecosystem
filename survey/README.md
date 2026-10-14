# State of The Developer Ecosystem Survey

## Installation

```
yarn
```

## Configuration

- Cloudflare's turnstile sitekey in [public/js/app.js](./public/js/app.js#L6)
- Survey's questions and answers in [public/survey.json](./public/survey.json)
- Titles, dates, etc.. in [public/index.html](./public/index.html)

## Development

```
yarn dev
```

## Monitoring

Fetch results and/or answers count via:

```
yarn count
```

or

```
yarn results
```

> [!TIP]
>
> To run those commands against a remote deployed instance, you must first login into Cloudflare:
>
> ```
> yarn wrangler login
> ```
>
> And then, simply append `--remote` to the commands. For example:
>
> ```
> yarn count --remote
> yarn results --remote
> ```

## CIP-179

The survey is being moved on chain as a [CIP-179](https://github.com/mpizenberg/Tessera/blob/main/frontend/cip-179.md) survey. `cip179/build.js` turns `public/survey.json` into the CIP-179 survey definition, and reports what doesn't fit (labels over 64 bytes, unsupported conditions, the definition size, ...):

```
yarn cip179
```

With `--owner <key hash> --end-epoch <epoch> --out <dir>`, it also writes the definition as cardano-cli metadata JSON, the widget's display conditions and translations, and the mapping used to convert responses back to `answers.json` rows.

To try the survey in the widget respondents will use:

```
yarn preview
```

and open http://localhost:8179/. The survey is rebuilt from `survey.json` on every reload, with the builder's problems listed above it (labels over 64 bytes are cut instead of stopping the build). Submitting checks the response the widget gives (size, CIP-179 validity, display conditions) and shows the `answers.json` row it converts to. Unsent answers are kept in the browser until "Forget my answers".

`yarn test` runs the 2025 answers through CIP-179 responses and back, to check that mapping.

`cip179/example/survey.json` is a test survey with every kind of question the builder supports (`yarn preview --survey cip179/example/survey.json`), and the files built from it. It is published on the preview testnet as `70928d2c8cca0fa616e8df54a54d5c311deeec354f5a261fa6c1009ffde89aa5#0`, ending at epoch 1530, with the sponsor key as owner in place of the placeholder in `definition.metadata.json`.

### Sponsored responses

Respondents don't need a wallet: the sponsor wallet pays for their transactions. The browser makes a temporary key, and the response's credential is that key. Then:

1. `POST /api/sponsor` (`functions/api/sponsor/index.js`) checks the Turnstile token. It also checks that the payload is one valid response to our survey, from a key. It leases a sponsor coin and builds the transaction from it, with the response key as required signer and a 5-minute validity window, signs it and returns it.
2. The browser signs the transaction id with its key, and `POST /api/sponsor/submit` (`functions/api/sponsor/submit.js`) adds that signature and submits the transaction through Koios. It only relays transactions the sponsor signed. Once Koios accepts it, the browser shows the response as submitted and forgets the unsent answers. If the sponsor is busy or the node refuses the transaction, the browser tries again, twice at most.

The sponsor pays at most 0.3 ada per response (about 3 KB of transaction), and once per respondent key: the browser keeps its key, and a respondent changes their answer with their own wallet. It also stops once the survey is cancelled, which it checks on chain every 10 minutes. `SPONSOR_DAILY_CAP`, in lovelace, would also cap what it spends in 24 hours.

Its state is in the D1 database `db` (`migrations/`, `cip179/sponsor-store.js`): its coins, one sponsorship per respondent key, and what it read from the chain. It tracks its coins itself: a sponsored transaction spends one coin and its change replaces it, usable 30 seconds later, once the other nodes know the transaction. So a response costs a single Koios call, its submission. Koios confirms the coins every 30 minutes, or when none is free or the node refuses one: it adds the coins the sponsor didn't know of, and forgets the transactions that never made it on chain. The transactions are built offline, with the protocol parameters read once per epoch.

The logic is in `cip179/sponsor.js`, configured by the `SPONSOR_*` vars in `wrangler.jsonc` (the network is `preview`, `preprod` or `mainnet`), and by the `SPONSOR_MNEMONIC` secret. `node cip179/sponsor-key.js` generates the sponsor wallet: its seed phrase goes to the gitignored `.dev.vars`, and it prints the address to fund. For a deployment, set it with `wrangler pages secret put SPONSOR_MNEMONIC` instead.

Each transaction spends one sponsor coin, at random among the largest ones, so the wallet needs several coins for respondents to submit at once. Once funded, split it, before the survey opens (the sponsor learns of the new coins at its next check):

```
node cip179/sponsor-split.js --coins 10 --submit
```

To try it, create the local database, then run the functions in the preview, with the survey published as `SPONSOR_SURVEY`:

```
yarn db:migrate
yarn preview --survey cip179/example/survey.json --sponsor
```

A "Submit on preview" button then appears under the response, with Turnstile's test site key on localhost, and links to the transaction once submitted. The page's key is kept in the browser, so it can submit only once, until "Forget my answers and key". The preview uses the same local database as `yarn dev`, which runs the functions in the Workers runtime. `cip179/test/sponsor-store.test.js` tests the state on an in-memory D1.

## Deployment

Deploy on Cloudflare by simply pushing the repository. The workers & pages then does its magic. Note that Turnstile secret needs to be configured in the Cloudflare dashboard directly.

The sponsor needs its D1 database: create it once with `wrangler d1 create cip179-sponsor`, put its id in `wrangler.jsonc`, and apply the migrations with `yarn db:migrate --remote` (again whenever `migrations/` changes).
