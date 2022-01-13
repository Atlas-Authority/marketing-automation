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

## Dev Setup

1. Install Node.js 16+ and NPM 7+
2. Copy [`.sample.env`](./.sample.env) to `.env` and set values.
3. `npm install` to install dependencies
4. `npm run build` to compile TypeScript into JavaScript at `out/`


## Running in Development

    $ npm run once


## Running in Production

    $ node out/bin/main.js


## CLI Options

    --loglevel    error | warn | info | verbose
        (Optional) What the engine should log to console.log()

    --savelogs somedir
        (Optional) Log helpful debug files under `data/somedir/`

## Developer NPM commands

```sh
# Run engine once
$ npm run once -- [options]

# Example of dry-run, using local data, with medium verbosity, and saving engine logs to './data/out'
$ npm run once -- --savelogs=out --loglevel=info

# Download live data and cache to disk
$ npm run download

# Run unit tests
$ npm run build # either build once
$ npm run watch # or watch and build
$ npm test

# Run engine 3 times,
#   starting with cached data,
#   and pumping output of each run
#     into input of next run
$ npm run 3x

# Explain what the engine does given certain SENs or transactions
# (Requires the engine to have been run on latest data locally)
$ npm run explain -- [--verbose] <SEN12345ABCDE>... | <transactions.json>
```


## Running during Development

First you must download MPAC data via `npm run download`. This will cache data locally in git-ignored `data` directory.

During development, output is not uploaded to HubSpot. It is printed to console if `--loglevel=verbose`.

To save logs about what the scoring engine is doing during a dry-run, pass a subdirectory of "data" to `--savelogs` (see above).


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

### 0.1.0 (2021-11-25)

- First public version
