# Marketing Automation Engine

Analyzes all your Atlassian Marketplace data, generates contacts/deals, and puts them into HubSpot.

More specifically:

1. Downloads and analyzes HubSpot and Atlassian Marketplace data
2. Generates contacts from all License/Transaction contact info
3. Identifies and flags Contact-Type for each Contact/Company
4. Matches up related MPAC events via similarity-scoring
5. Updates Contacts based on match results
6. Generates Deals based on match results
7. Upserts all generated/updated HubSpot data entities

This runs in an ENV-configurable loop.

Read about the engine logic in detail in [docs/ENGINE.md](./docs/ENGINE.md).

Implemented in Node.js (TypeScript) and can build a Docker image.

---

## HubSpot Setup

See [docs/HUBSPOT.md](./docs/HUBSPOT.md).


## Running in Development

Install Node.js 16+ and NPM 7+

Copy [`.sample.env`](./.sample.env) to `.env` and set values.

Install dependencies:

```sh
$ npm install
```

Compile TypeScript in background:

```sh
$ npm run watch
```

For general development:

```sh
$ npm run download -- --help  # Download MPAC & HubSpot data
$ npm run once     -- --help  # Dry-run engine once on cached inputs
$ npm run 3x       -- --help  # Dry-run engine 3x, piping output to input
```

* Data must be downloaded before local dry-runs.
* Pass `--loglevel=verbose` or `--savelogs=out` to examine engine logic.

Running tests:

```sh
$ npm run test                # Run once
$ npm run test -- --watchAll  # Run during dev
```


## Running in Production

```sh
$ node out/bin/main.js  # This always uses live inputs/outputs
```


## Changelog

### Unreleased

- Renamed `npm start` to `npm run once` (Use Docker image for continuous background processing)
- Renamed ENV variables `MPAC_PASS` to `MPAC_API_KEY`
- Added optional "Associated Partner" keys on Deals and Contacts.
- Fixed bug where refunds sometimes weren't being processed by MAE.
- Deals now always use transaction ID when available.
- Refunded deals now have their amounts set to zero.
- Purchased inactive licenses are set to closed-won if not refunded.
- Added `--savelogs=somedir` as the way to manually log debug files.
- Renamed `npm run multiple` to `npm run 3x`.
- Updated `npm run 3x` to save logs to `data/run{1..3}/`.
- Added (optional) `--skiplogs=true` option to `npm run 3x`.
- Sped up license scorer down to 12% original run time in some cases.
- Removed `--cached-fns` option and cached-fns data file usage.
- Removed `--in` and `--out`
  - `npm run once` always uses local IO (for local development)
  - `node out/bin/main.js` always uses remote IO (for production)
  - To use remote during local dev, change it in the code (at your own risk)
- Added `--help` option to developer commands.

### 0.1.0 (2021-11-25)

- First public version
