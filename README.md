# Marketing Automation

*Node.js app in Docker for automating marketing.*

---

## Setup

1. Copy `.sample.env` to `.env` and set values.
2. `npm install`

## Running

```sh
$ npm run build  # or npm run watch
$ node out/bin/main.js --downloader=live --uploader=live
```

## Development

Running the engine live (steps above) will cache data locally in git-ignored `data` directory. After it's cached, you can use `--downloader=cached` for faster development and to avoid API calls.

Instead of uploading to Hubspot, you can use `--uploader=console-verbose` to print data to console that would have been uploaded, or `console-quiet` to just show array counts.

After running the engine, to test logic *after* the Scoring Engine runs, pass `--cached-fns=scorer.dat` to reuse the most recently results of the Scoring Engine.

## Engine Logic

1. **Download all initial data.**

    This includes downloading:

    * All Licenses and Transactions from MPAC
    * All Contacts, Deals, and Companies from Hubspot

    This gathers the information to map contacts to companies, and contacts to deals, but we don't yet map them here.

    This also fetches secondary emails for each contacts, which we later use when merging generated contacts.

2. **Identify partner domains.**

    Partner domains are collected from:

    * The ENV variable `PARTNER_DOMAINS` which is a comma-separated list of domains
    * Look through all Licenses and Transactions
    * If any have a partner contact, use the domain in its email

    The result is the unique union of all these domains.

3. **Flag externally created partners.**

    Sometimes contacts are created outside the system, but need to be flagged as partners within the engine.

    1. Look through all existing contacts,
    2. For any that have `email` but not `contact_type`:
    3. If it's in a partner domain, flag as Partner.

4. **Generate contacts.**

    1. First, we generate contacts indiscriminately from all Licenses and Transactions.

        * We look through Tech contact, Billing contact, and Partner contact, in each.
        * If it's a Partner contact, or if it's in the partner domains, we flag as Partner, otherwise as Contact.
        * Otherwise, we just fill in all the details found in that contact.

    2. The previous step results in many duplicate contacts (by email).

        * First, because the same email address may have obtained multiple licenses/transactions.
        * But also, because contacts may have used primary and secondary emails for different purchases.

        So now our job is to merge these down into a single canonical contact, which we'll upsert into Hubspot later.

        1. Gather all contacts into a mapping of email to list of generated-contacts with that email
        2. Go through every set of secondary-emails, and move those generated-contacts into the primary-email's list of contacts
        3. Now, for each set of duplicate contacts for every primary email, merge their properties down into a single canonical contact:

            1. Find the most recently updated contact, that's the canonical contact.
            2. Set the canonical contact's email to the primary email.
            3. If any contact in the set is a Partner, the canonical contact is a Partner.
            4. Find the most recent pair of `firstname` and `lastname` in the contacts, and use that pair if found, otherwise use the first found of each.
            5. Find the most recent pair of `city` and `state` in the contacts, and use that pair if found, otherwise use the first found of each.
            6. Find the most recent `phone` and use that if found.

5. **Find and flag Partners.**

    1. By company: Companies have multiple contacts, via a contact's `company_id`. If any Contact in a Company is a Partner, then all of the Contacts should also be marked Partner.

    2. By domain: Group contacts by domain, and if any are Partner, flag them all as Partner within that domain. Exclude mass-use domains.

6. **Create or update Contacts in Hubspot.**

    The contacts generated in the past few steps are the **canonical Contacts**. Thus, Hubspot must be made to completely reflect what we have generated locally. For any Contacts we create in Hubspot, we map their ID back onto the local contact for the Engine's next steps.

7. **Run Scoring Engine.**

    The goal of the Scoring Engine is to group licenses and transactions into sets of related/associated contact actions, separated by no more than 90 days each. Thus, we can see a series of evals, or an eval and a purchase (an upgrade), and other patterns, by the same contact.

    1. First, we group all licenses and transactions by the same `addonLicenseId`.

       Note:* The license property `addonLicenseId` is separate from `licenseId`, which sometimes has a different value, based on `hostLicenseId` instead.

       At the end of this step, we have a mapping where each `addonLicenseId` corresponds to exactly one License, and zero or more Transactions, with the same `addonLicenseId`.

    2. Then we group each license by `hosting` and `addonKey`, so that we get groups of `licenseAddonKey`s for the same "product".

    3. Next we run a license-similarity scorer to match up these groups to each other, within the same `hosting` and `addonKey` groups.

       * The license-similarity scorer ignores licenses that are over 90 days apart. If two licenses are 100 days apart, but they're each connected to a license that's exactly 50 days between them, all three will eventually get connected together into the same group. But not at this step.

       * If the license is the same contact (by tech or billing email), it's definitely a match.

       * Run complex scoring based on email, domain, company name, company address, tech name, and tech phone, to see if both licenses were done by the same contact.

    3. Now that we have a list of score between License 1 and License 2, for every possible license within the same "product" group, we group them into probably-related groups over a given score threshold.

       Given the following table:

       | L1  | L2  | Score |
       |-----|-----|-------|
       | `a` | `b` | 50    |
       | `a` | `c` | 50    |
       | `b` | `c` | 30    |
       | `d` | `a` | 20    |
       | `d` | `b` | 20    |
       | `d` | `c` | 20    |

       If we group them with threshold=40, we'll see `[a, b, c]` all in the same group, because even though `b` and `c` didn't seem directly related, they were connected through `a` which they're both related to based on the threshold. But `[d]` will be in a group by itself, because it wasn't related to any of the others.

8. **Update remaining Contact properties.**

    Now that we've run the license matcher and made groups of related licenses (and their accompanying transactions), we can use this to update more information about contacts. So we do a second round of contact updating.

    We can match up each Contact to groups of related Licenses. So if Alice made 1 eval and 3 puchases in early 2020, then 3 more purchases in late 2020, she'll have two related sets: first, of 4 licenses, and then of 3 licenses. (Each of these licenses may have 0 or more transactions.)

    So we enumerate each group of licenses for each contact, to generate the following properties:

    1. *License Tier:*

       The highest number among the following calculations:

       * The contact's existing `license_tier` if present
       * Each license's `evaluationOpportunitySize`, where "Unlimited Users" is 10001, any number is itself, otherwise the rest are -1
       * Each license's `tier`, where "Unlimited Users" is 10001, any other value is -1
       * Each transactions's `purchaseDetails.tier`, where "Unlimited Users" is 10001, otherwise the number is extracted from the tier
       * If there are no values at all, we default to -1

    2. *Last MPAC Event:*

       The highest among each license's `maintenanceStartDate` and each transaction's `purchaseDetails.saleDate`.

    3. *Deployment:*

       1. Gather every license's `hosting` property, as unique values.
       2. If there's only one value, use that, otherwise use "Multiple".

    4. *Related Products:*

       This is the combination of each group of license's `addonKey`.

    Then we update all of these in Hubspot again as needed.

  9. **Generate Deals.**

     The final step is to generate deals from the given matches.
 
     As the result of the Scoring Engine in Step 7, we now have related groups of licenses and transactions, grouped by hosting, addon key, and time (no more than 90-day gaps within each set).
 
     For this step, we ignore all sets where the newest license is still older than 90 days, since we don't need to backfill stale deals.
 
     For each group of associated licenses, compromising a series of related customer events:
 
     * If all licenses have a tech contact that's in a mass-email domain or a partner domain, ignore this set of licenses.
 
     * If every license in this set is an Eval:
 
       * If there's an existing deal:
 
         1. If the latest license is active, update the close-date (from maintenanceEndDate) and addonLicenseId.
 
         2. If it's not active, mark it as Closed Lost, and update the addonLicenseId.
 
       * If there's no existing deal:
 
         1. If the latest license is active, create an Eval.
 
         2. If it's not active, ignore this license set (but log it so we know why it was ignored).
 
     * Else, if some licenses are paid:
 
       * If there's no evals:
 
         * They couldn't have upgraded.
         * Do nothing, just log this situation.
 
       * Else if the chronologically first license is paid:
 
         * It's probably a renewal.
         * Evals after the first paid are probably QA or something.
         * Do nothing, just log this situation.
 
       * Else if the first is an eval, and they have eventual paids:
 
         * It's an upgrade.
 
         * If there's a deal, update its addonLicenseId.
         * Whether creating or updating:
           * Set amount based on `purchaseDetails.vendorAmount` if available
           * Set deal stage to Closed Won.
 
     When we create a new deal, we always set:
 
       * Associated Contacts: This is the tech contact, billing contact, and partner contact, any of which are present.
 
       * License Tier: We set this based on the same calculation as above, but only using the most recent license as input.
 
     Now we just reflect this in Hubspot.
