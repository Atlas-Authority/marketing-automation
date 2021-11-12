# Marketing Automation

*Node.js app for automating marketing.*

---

## HubSpot Setup

Add these fields:

### Contacts

| Field            | Type     | Allowed Values                           | ENV var                             | Required |
| ---------------- | -------- | ---------------------------------------- | ----------------------------------- | -------- |
| License Tier     | Number   | *                                        | `HUBSPOT_CONTACT_LICENSE_TIER_ATTR` | ❌        |
| Last MPAC Event  | Date     | *                                        | TBD                                 | ❌        |
| Contact Type     | 1-Select | 'Partner' or 'Customer'                  | TBD                                 | ❌        |
| Region           | 1-Select | "region" of MPAC records                 | TBD                                 | ❌        |
| Related Products | N-Select | `ADDONKEY_PLATFORMS` rhs vals            | TBD                                 | ❌        |
| Products         | N-Select | "addonKey" of MPAC records               | `HUBSPOT_CONTACT_PRODUCTS_ATTR`     | ❌        |
| Deployment       | 1-Select | "hosting" of MPAC records, or 'Multiple' | `HUBSPOT_CONTACT_DEPLOYMENT_ATTR`   | ❌        |

### Deals

| Field            | Type        | Allowed Values             | ENV var                            | Required |
| ---------------- | ----------- | -------------------------- | ---------------------------------- | -------- |
| License Tier     | Number      | *                          | TBD                                | ❌        |
| Related Products | 1-Select    | `DEAL_RELATED_PRODUCTS`    | TBD                                | ❌        |
| Origin           | 1-Select    | `DEAL_ORIGIN`              | TBD                                | ❌        |
| Deployment       | 1-Select    | "hosting" of MPAC records  | `HUBSPOT_DEAL_DEPLOYMENT_ATTR`     | ❌        |
| App              | 1-Select    | "addonKey" of MPAC records | `HUBSPOT_DEAL_APP_ATTR`            | ❌        |
| Country          | 1-line Text | "country" of MPAC records  | TBD                                | ❌        |
| AddonLicenseId   | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_ADDONLICENESID_ATTR` | ✔️        |
| TransactionId    | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_TRANSACTIONID_ATTR`  | ✔️        |


## Dev Setup

1. Install Node.js 16+ and NPM 7+
2. Copy [`.sample.env`](./.sample.env) to `.env` and set values.
3. `npm install`

## Running

    $ npm start -- --in=remote --out=remote

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
$ npm start -- [options]

# Example of dry-run, using local data and cached scorer data, with medium verbosity
$ npm start -- --in=local --out=local --cached-fns=scorer.json --loglevel=info

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

## Engine Logic

### High-level Overview

1. Download HubSpot and Marketplace data
2. Generate contacts from all Licenses/Transactions
3. Identify and flag Contact Type for each Contact/Company
4. Match License/Transaction groups via similarity-scoring
5. Update Contacts based on match results
6. Generate Deals based on match results
7. Upsert HubSpot data entities

## Changelog

- Coming soon
