# State of The Developer Ecosystem Survey

Since 2026, the survey's responses are published on the Cardano chain. The 2025 site, which kept them in Cloudflare KV, is in the git history; its questions and answers are in [2025/data/](../2025/data).

## Installation

```
yarn
```

## Files

- `site/`: the page respondents use, built into `dist/` by `yarn site`.
- `cip179/`: the survey builder (`build.js`, `definition.js`), the preview (`preview.js`, `preview/`), the site's build (`site.js`) and modules, the sponsor (`sponsor*.js`), and the tests (`test/`).
- `cip179/draft/`: the 2026 survey's draft.
- `functions/api/sponsor/`: the sponsor's endpoints, run by Cloudflare Pages.
- `migrations/`: the sponsor's D1 database.
- `wrangler.jsonc`: the Cloudflare config, with the sponsor's vars. Local secrets go in the gitignored `.dev.vars`.

## CIP-179

The survey is a [CIP-179](https://github.com/mpizenberg/Tessera/blob/main/frontend/cip-179.md) survey. It is written in SurveyJS's format, in a `survey.json` (`--survey`, by default `cip179/draft/survey.json`), and `cip179/build.js` turns it into a CIP-179 survey definition.

### From `survey.json` to a running survey

1. **Check it.** `yarn cip179` reports what doesn't fit CIP-179 or the widget (labels over 64 bytes, unsupported conditions, ...), and the size of the definition and of the longest response. It writes nothing.
2. **Try it** in the widget respondents will use: `yarn preview`, and open http://localhost:8179/. The survey is rebuilt from `survey.json` on every reload, with the builder's problems listed above it (labels over 64 bytes are cut instead of stopping the build). Submitting checks the response the widget gives (size, CIP-179 validity, display conditions) and shows the `answers.json` row it converts to. Unsent answers are kept in the browser until "Forget my answers".
3. **Write its files**, once there are no errors:

   ```
   yarn cip179 --owner <key hash> --end-epoch <epoch> --out <dir>
   ```

   The owner is the key that signs the definition's publication, and the only one that can cancel the survey. Responses count until the end of the end epoch. In `<dir>`:

   - `definition.metadata.json`: the definition, as cardano-cli detailed metadata JSON at label 17. This is what gets published.
   - `widget.json`: what the site gives the widget beside the definition: display conditions, translations, None labels, the free-text size limit, and the answers that end the survey before its form.
   - `mapping.json`: the SurveyJS question and value each CIP-179 question and option comes from, to convert responses back to `answers.json` rows.

   Commit the three: the site is built from them, and the export needs the mapping.
4. **Try it in the site**, before publishing: `yarn site --survey <dir> --unpublished`, then `yarn dev` (see [The survey site](#the-survey-site)).
5. **Publish the definition** in a transaction with `definition.metadata.json` as its metadata, signed by the owner key: with cardano-cli (`--metadata-json-file definition.metadata.json --json-metadata-detailed-schema --required-signer-hash <owner key hash>`), or by importing the file in Tessera's Create page and publishing it with the owner's wallet. The survey's reference is `<tx id>#0`.
6. **Point the sponsor at it**: set `SPONSOR_SURVEY` in `wrangler.jsonc` to `<tx id>#0`. `yarn site --survey <dir>` then checks the files against the chain and builds the site to deploy (see [Deployment](#deployment)).

A multi-select's None item (`showNoneItem` on a checkbox or tagbox) isn't an option on chain: the question takes 0 options, and the widget shows its None box, worded by `noneText` (SurveyJS's "None" without it). A condition on it, such as `{question3} noneof ['none']`, names it `"none"` for the widget, and the export writes it back as `["none"]`. On a single choice, None stays an option.

`yarn test` runs the 2025 answers through CIP-179 responses and back, to check that mapping.

`cip179/draft/survey.json` is the draft of the 2026 survey, in English and French. Its files, beside it, are written for a first test on the preview testnet. `SPONSOR_SURVEY` in `wrangler.jsonc` still names a test survey published on the preview testnet, `70928d2c8cca0fa616e8df54a54d5c311deeec354f5a261fa6c1009ffde89aa5#0`. It was built from `cip179/example/`, a survey with every kind of question the builder supports, now in the git history.

### Sponsored responses

Respondents don't need a wallet: the sponsor wallet pays for their transactions. The browser makes a temporary key, and the response's credential is that key. Then:

1. `POST /api/sponsor` (`functions/api/sponsor/index.js`) checks the Turnstile token. It also checks that the payload is one valid response to our survey, from a key. It leases a sponsor coin and builds the transaction from it, with the response key as required signer and a 5-minute validity window, signs it and returns it.
2. The browser signs the transaction id with its key, and `POST /api/sponsor/submit` (`functions/api/sponsor/submit.js`) adds that signature and submits the transaction through Koios. It only relays transactions the sponsor signed. Once Koios accepts it, the browser shows the response as submitted and forgets the unsent answers. If the sponsor is busy or the node refuses the transaction, the browser tries again, twice at most.

A refusal comes as `{ error, code }`. The survey site words it from the code, in the respondent's language.

The sponsor pays at most 0.5 ada per response (about 7.8 KB of transaction), and once per respondent key: the browser keeps its key, and a respondent changes their answer with their own wallet. It also stops once the survey is cancelled, which it checks on chain every 10 minutes. `SPONSOR_DAILY_CAP`, in lovelace, would also cap what it spends in 24 hours.

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
yarn site --survey <dir>
yarn dev
```

and open http://localhost:8788/. `yarn site` writes `dist/`, with the survey in the page's script. The network and the survey's reference are the sponsor's, from `wrangler.jsonc`. The build stops unless the definition is the one published there, which it reads from Koios (`--offline` skips this check).

With `--unpublished`, the site is built for a survey not published yet, to try it: the definition isn't checked, and the page doesn't send answers to the sponsor ("Publish my answers" says the survey isn't published yet). The browser keeps the answers to each unpublished definition apart.

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
