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

All this runs in an ENV-configurable loop.

Uses Node.js and Docker.

---

## HubSpot Setup

Add these fields:

### Contacts

| Field            | Type     | Allowed Values                           | ENV var                                 | Required |
| ---------------- | -------- | ---------------------------------------- | --------------------------------------- | -------- |
| License Tier     | Number   | *                                        | `HUBSPOT_CONTACT_LICENSE_TIER_ATTR`     | ❌        |
| Last MPAC Event  | Date     | *                                        | `HUBSPOT_CONTACT_LAST_MPAC_EVENT_ATTR`  | ❌        |
| Contact Type     | 1-Select | 'Partner' or 'Customer'                  | `HUBSPOT_CONTACT_CONTACT_TYPE_ATTR`     | ❌        |
| Region           | 1-Select | "region" of MPAC records                 | `HUBSPOT_CONTACT_REGION_ATTR`           | ❌        |
| Related Products | N-Select | `ADDONKEY_PLATFORMS` rhs vals            | `HUBSPOT_CONTACT_RELATED_PRODUCTS_ATTR` | ❌        |
| Products         | N-Select | "addonKey" of MPAC records               | `HUBSPOT_CONTACT_PRODUCTS_ATTR`         | ❌        |
| Deployment       | 1-Select | "hosting" of MPAC records, or 'Multiple' | `HUBSPOT_CONTACT_DEPLOYMENT_ATTR`       | ❌        |

### Deals

| Field            | Type        | Allowed Values             | ENV var                              | Required |
| ---------------- | ----------- | -------------------------- | ------------------------------------ | -------- |
| License Tier     | Number      | *                          | `HUBSPOT_DEAL_LICENSE_TIER_ATTR`     | ❌        |
| Related Products | 1-Select    | `DEAL_RELATED_PRODUCTS`    | `HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR` | ❌        |
| Origin           | 1-Select    | `DEAL_ORIGIN`              | `HUBSPOT_DEAL_ORIGIN_ATTR`           | ❌        |
| Deployment       | 1-Select    | "hosting" of MPAC records  | `HUBSPOT_DEAL_DEPLOYMENT_ATTR`       | ❌        |
| App              | 1-Select    | "addonKey" of MPAC records | `HUBSPOT_DEAL_APP_ATTR`              | ❌        |
| Country          | 1-line Text | "country" of MPAC records  | `HUBSPOT_DEAL_COUNTRY_ATTR`          | ❌        |
| AddonLicenseId   | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_ADDONLICENESID_ATTR`   | ✔️        |
| TransactionId    | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_TRANSACTIONID_ATTR`    | ✔️        |


## Dev Setup

1. Install Node.js 16+ and NPM 7+
2. Copy [`.sample.env`](./.sample.env) to `.env` and set values.
3. `npm install`

## Running

    $ npm run once -- --in=remote --out=remote

## CLI Options

    --in   local | remote
        Whether to use disk-cached values, or download live data

    --out  local | remote
        Whether to cache output to disk and log, or upload live data

    --cached-fns  scorer.json
        (Optional) Reuse cached results of given function

    --loglevel    error | warn | info | verbose | detailed
        (Optional) What the engine should log to console.log()

## Developer NPM commands

```sh
# Run engine once
$ npm run once -- [options]

# Example of dry-run, using local data and cached scorer data, with medium verbosity
$ npm run once -- --in=local --out=local --cached-fns=scorer.json --loglevel=info

# Download live data and cache to disk
$ npm run download

# Run unit tests
$ npm run build # either build once
$ npm run watch # or watch and build
$ npm test

# Run engine multiple times,
#   starting with cached data,
#   and pumping output of each run
#     into input of next run
$ npm run multiple

# Explain what the engine does given certain SENs or transactions
# (Requires the engine to have been run on latest data locally)
$ npm run explain -- [--verbose] <SEN12345ABCDE>... | <transactions.json>
```

## Running during Development

Running the engine live (steps above) will cache data locally in git-ignored `data` directory. After it's cached, you can use `--in=local` for faster development and to avoid API calls.

Instead of uploading to Hubspot, you can use `--out=local` and `--loglevel=verbose` (the default) to print data to console that would have been uploaded, or `--loglevel=info` to just show array counts.

After running the engine, to test logic *after* the Scoring Engine runs, pass `--cached-fns=scorer.json` to reuse the most recently results of the Scoring Engine.

## Changelog

### Unreleased

- Renamed `npm start` to `npm run once` (Use Docker image for continuous background processing)
- Renamed ENV variables `MPAC_PASS` to `MPAC_API_KEY`

### 0.1.0 (2021-11-25)

- First public version
