# State of The Developer Ecosystem Survey

Since 2026, the survey's responses are published on the Cardano chain. The 2025 site, which kept them in Cloudflare KV, is in the git history; its questions and answers are in [2025/data/](../2025/data).

## Installation

```
yarn
```

## Files

- `site/`: the page respondents use, built into `dist/` by `yarn site`.
- `cip179/`: the survey builder (`build.js`, `definition.js`), the preview (`preview.js`, `preview/`), the site's build (`site.js`) and modules, the sponsor (`sponsor*.js`), and the tests (`test/`).
- `cip179/example/`: a test survey, and the files built from it.
- `functions/api/sponsor/`: the sponsor's endpoints, run by Cloudflare Pages.
- `migrations/`: the sponsor's D1 database.
- `wrangler.jsonc`: the Cloudflare config, with the sponsor's vars. Local secrets go in the gitignored `.dev.vars`.

## CIP-179

The survey is a [CIP-179](https://github.com/mpizenberg/Tessera/blob/main/frontend/cip-179.md) survey. `cip179/build.js` turns a SurveyJS survey (`--survey`, by default `cip179/example/survey.json`) into the CIP-179 survey definition, and reports what doesn't fit (labels over 64 bytes, unsupported conditions, the definition size, ...):

```
yarn cip179
```

With `--owner <key hash> --end-epoch <epoch> --out <dir>`, it also writes the definition as cardano-cli metadata JSON, the widget's display conditions and translations, the answers that end the survey before its form, and the mapping used to convert responses back to `answers.json` rows.

To try the survey in the widget respondents will use:

```
yarn preview
```

and open http://localhost:8179/. The survey is rebuilt from `survey.json` on every reload, with the builder's problems listed above it (labels over 64 bytes are cut instead of stopping the build). Submitting checks the response the widget gives (size, CIP-179 validity, display conditions) and shows the `answers.json` row it converts to. Unsent answers are kept in the browser until "Forget my answers".

`yarn test` runs the 2025 answers through CIP-179 responses and back, to check that mapping.

`cip179/example/survey.json` is a test survey with every kind of question the builder supports, and the files built from it. It is published on the preview testnet as `70928d2c8cca0fa616e8df54a54d5c311deeec354f5a261fa6c1009ffde89aa5#0`, ending at epoch 1530, with the sponsor key as owner.

### Sponsored responses

Respondents don't need a wallet: the sponsor wallet pays for their transactions. The browser makes a temporary key, and the response's credential is that key. Then:

1. `POST /api/sponsor` (`functions/api/sponsor/index.js`) checks the Turnstile token. It also checks that the payload is one valid response to our survey, from a key. It leases a sponsor coin and builds the transaction from it, with the response key as required signer and a 5-minute validity window, signs it and returns it.
2. The browser signs the transaction id with its key, and `POST /api/sponsor/submit` (`functions/api/sponsor/submit.js`) adds that signature and submits the transaction through Koios. It only relays transactions the sponsor signed. Once Koios accepts it, the browser shows the response as submitted and forgets the unsent answers. If the sponsor is busy or the node refuses the transaction, the browser tries again, twice at most.

A refusal comes as `{ error, code }`. The survey site words it from the code, in the respondent's language.

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
yarn preview --sponsor
```

A "Submit on preview" button then appears under the response, with Turnstile's test site key on localhost, and links to the transaction once submitted. The page's key is kept in the browser, so it can submit only once, until "Forget my answers and key". The preview uses the same local database as `yarn dev`, which runs the functions in the Workers runtime. `cip179/test/sponsor-store.test.js` tests the state on an in-memory D1.

### The survey site

`site/` is the page respondents will use: the widget, between a welcome screen and a submit screen. It is built for one survey, from the files written by `yarn cip179 --out`:

```
yarn site --survey cip179/example
yarn dev
```

and open http://localhost:8788/. `yarn site` writes `dist/`, with the survey in the page's script. The network and the survey's reference are the sponsor's, from `wrangler.jsonc`. The build stops unless the definition is the one published there, which it reads from Koios (`--offline` skips this check).

A respondent goes through these screens (`site/flow.js`):

1. A welcome, with the notice that answers are public and permanent. It also offers the answers that end the survey before its form (SurveyJS "complete" triggers): nothing is recorded for them.
2. The questions, one per screen.
3. A submit screen, where Turnstile and the sponsor run. A refusal is told there, and the answers are kept.
4. A thank-you, with a link to the transaction. Later visits from the same browser show it too.

A survey past its end epoch, or cancelled, shows as closed.

The page's texts are in `site/texts/`, one file per language: English and French. A survey's translations in other languages are left out. The respondent's key, unsent answers and language are kept in `localStorage`, for each survey (`cip179/respondent.js`, which the preview uses too). The page requests nothing from other sites until the submit screen, which loads Turnstile.

## Deployment

Cloudflare Pages deploys the repository when it is pushed. Its build settings, in the Cloudflare dashboard, are still those of the 2025 site, which served `public/`: they must build with `yarn site --survey <dir>`, from `survey/`, serve `dist/`, and bind the D1 database as `db`. Turnstile's site key is in `cip179/respondent.js`, and its secret is set in the dashboard.

The sponsor needs its D1 database: create it once with `wrangler d1 create cip179-sponsor`, put its id in `wrangler.jsonc`, and apply the migrations with `yarn db:migrate --remote` (again whenever `migrations/` changes). Commands with `--remote` need `yarn wrangler login` first.
