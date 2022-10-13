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

Implemented in Node.js (TypeScript) and can build a Docker image (hosted by [GitHub](https://github.com/Atlas-Authority/marketing-automation/pkgs/container/marketing-automation)).

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
$ npm run download     # Download MPAC & HubSpot data
$ npm run once [fast]  # Dry-run engine once on cached inputs
$ npm run 3x   [fast]  # Dry-run engine 3x, piping output to input
```

* Data must be downloaded before local dry-runs
* Engine log files are written under `data/[input-dir]/[log-dir]/`
* Running with `fast` skips time-consuming logs

Running tests:

```sh
$ npm run test                # Run once
$ npm run test -- --watchAll  # Run during dev
```


## Running in Production

```sh
$ node out/bin/main.js  # This always uses live inputs/outputs
```

See [Analyse Data Shift](./docs/ANALYSE_DATA_SHIFT.md) docs for this sub-functionality.


## Changelog

### 0.5.1

- Fixed bug preventing `HUBSPOT_ASSOCIATION_TYPE_MAPPINGS` from being used

### 0.5.0

- Changed Contact 'Deployment' field; see field in [HUBSPOT.md](./docs/HUBSPOT.md) for details
- Fixed bug that might have prevented some multi-select fields from updating
- Fixed bug that crashed the engine when deals have duplicates and they all have some manual activity
- Deprecated `HUBSPOT_API_KEY` in favor of `HUBSPOT_ACCESS_TOKEN` with [private apps](https://developers.hubspot.com/docs/api/migrate-an-api-key-integration-to-a-private-app)
- Added support for custom HubSpot API associations via ENV variable `HUBSPOT_ASSOCIATION_TYPE_MAPPINGS`

### 0.4.1

- Added Managed Fields; see [HUBSPOT.md](./docs/HUBSPOT.md) for details

### 0.4.0

- Added `KEEP_DATA_SETS` ENV variable.
- Added `LATE_TRANSACTION_THRESHOLD_DAYS` ENV variable.
- Added `npm run analyze-data-shift` task.
- Main loop now analyzes and reports on data shift.

### 0.3.0

- Docker image now requires persistent `./data` directory
- Engine logs now written to input subdirectory
- Fixed occasional bug when writing large log files
- Removed `loglevel` option
  - Info statements are now logged to stdout
  - Warnings and errors are now logged to stderr
  - Verbose logs are now written to log files
- Removed `savelogs` option
  - Now always saves all logs
  - Added `fast` option to skip slow logs

### 0.2.0 (2022-01-19)

CLI changes:

- Renamed `npm start` to `npm run once`.
- Renamed `npm run multiple` to `npm run 3x`.
- Added `help` option.
- Added `savelogs=somedir` option.
- Removed `--cached-fns` option.
- Removed `--in` and `--out`.
  - `npm run once` always uses local IO (for local development)
  - Docker image always uses remote IO (for production)
- Removed `--` prefix from CLI arguments

ENV changes:

- Renamed ENV variables `MPAC_PASS` to `MPAC_API_KEY`
- Added new HubSpot keys (see [HUBSPOT.md](./docs/HUBSPOT.md))

Engine changes:

- Added optional "Associated Partner" keys on Deals and Contacts.
- Fixed bug where refunds sometimes weren't being processed by MAE.
- Deals now always use transaction ID when available.
- Refunded deals now have their amounts set to zero.
- Purchased inactive licenses are set to closed-won if not refunded.
- Sped up license scorer down to 12% original run time in some cases.
- Fixed bug where duplicate deals were not correctly identified.
- Fixed bug that sometimes didn't print some duplicate deals.

### 0.1.0 (2021-11-25)

- First public version
