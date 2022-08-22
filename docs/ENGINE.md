# Engine logic

See the [README](../README.md) for a high-level overview of each engine run.

The following sections describe those high-level steps, in order, in full semantic detail.

### Lower-level overview

The engine uses both HubSpot data and MPAC data as inputs.

(On the first run, HubSpot data will be empty, so the engine will populate it.)

Contacts and Companies:

1. MPAC records are used to create and update Contacts as-needed
2. MPAC records are used to determine Contact Types
3. Contact Types are assigned to Contacts and Companies
4. Contact Types are used to associate Contacts and Companies

Deals:

1. MPAC records are used to generate Deal Actions
2. Deal Actions are used to generate Deal Events
3. Deal Events are used to create or update Deals as-needed

Finally: Deal, Company, and Contact changes are upsynced to HubSpot.

### Downloading data to operate on

The engine downloads:

- All HubSpot Deals with Pipeline=MPAC
- All HubSpot Contacts
- All HubSpot Companies
- All MPAC Licenses
- All MPAC Transactions

It then transforms all these into in-memory representations to more easily work with: mutable HubSpot entities and immutable MPAC records.

These in-memory HubSpot entities will be operated on throughout the rest of the engine run, and upsynced in the final step.

At this phase, MPAC contact fields are normalized, e.g. the literal string `"null"` is removed, newlines are removed, and fields are trimmed.

We calculate on each record anything we can ahead of time here (currently only MPAC max-tier), and remove MPAC records with invalid emails.

### Identifying contact types by MPAC data

The two types of contact types are Partner and Customer. This phase identifies all known domains as being one or the other.

The initial source of this info is domains in MPAC contacts. If a domain is in a partner contact, then it's a partner domain, and any other contact with the same domain is also a partner contact.

We also add partner domains from an optional ENV variable if you have some you know for sure to be partners.

We remove from the partners list any mass email providers such as gmail and hotmail, and all known burner (throwaway) email providers. A list of such domains is gathered from 3 different sources:

1. The NPM lib [burner-email-providers](https://www.npmjs.com/package/burner-email-providers)
2. The NPM lib [email-providers](https://www.npmjs.com/package/email-providers)
3. The URL https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv

After all this, we finally have a set of domains that are known to be Partners. The rest are Contacts.

Now we just flag all contacts, if their domain is in one of these two sets, as having that contact type.

We also flag all contacts in the same HubSpot Company as a partner as also being partners. (We don't mark their domains as being Partner domains.)

### Generating contacts

Every MPAC record (licenses and transactions) is used to create or update a HubSpot Contact, based on tech contact, billing contact, and partner contact.

Since multiple MPAC records will relate to the same HubSpot contact, these are merged so that the latest set of data is used to update the HubSpot contact.

If possible, related pairs of data are updated together, e.g. firstname + lastname, city + state. When these can't be set in pairs, we at least set them separately to avoid having no value.

After this, the engine has a combination of all existing and new Contacts, ready for further engine processing, and finally upsyncing in the last phase.

### Matching MPAC events

#### Context

This phase assumes a few things:

1. Each license is a unique object within MPAC data
2. Each transaction points to exactly one license
3. Some transactions point to the same license
4. Therefore, we can match up every license with 0-N transactions
5. Each license keeps a reference to all its transactions (as an array)
6. Each transaction keeps a reference to its license
7. If a transaction doesn't have an accompanying license, we log and omit it

Using TypeScript to explain this, we basically have:

```ts
class License {
  public transactions!: Transaction[];
  // ...
}

class Transaction {
  public license!: License;
  // ...
}
```

#### Motivation

The goal of this phase is to match up each license with all other licenses that they are *probably related to*, meaning, probably part of the same series of MPAC events by the same person/people.

An example might be a Project Lead getting evals for a team, and then a separate Product Manager in the same company purchasing licenses but with a different email, and maybe a QA team getting evals for testing afterwards.

Once we have this match info, we'll be able to generate deals from them. So it's important to make sure we don't get false positives, so we don't send a deal intended for one company to another unrelated customer.

#### Logs

Since this phase of engine logic is very dependent on data, and requires a lot of fine tuning via trial/error, copious logs are output to `data/[input-dir]/[log-dir]/matched*` for inspection.

For a deeper understanding of this phase, run the engine with out=local, and inspect the logs. For convenience, they're output in both JSON and CSV formats, but they're the same data.

#### Logic

First, we group licenses by app and hosting, since each Deal must be for one product on one Atlassian platform.

In each group, we score every license with every other license.

We score by pairs, creating sets when combined, so that:

* If A and B match, then a set [A, B] is created
* If B and C match, then set [A, B] is updated to [A, B, C]
* If D never matches anything, it'll be in [D] all by itself.

In practice, this means that if 2 licenses are 100 days apart, but matched with one in common 50 days between each, they'll all be matched up together.

Sometimes we're certain about a match or non-match:

1. If the licenses are >90 days apart, we assume they're not part of the same series of MPAC events, so we never match them.
2. If they have exactly the same tech or billing emails, or are part of the exact same HubSpot contact, they're definitely a match.

In all other case, match scoring is based on a threshold. Certain factors add to the threshold:

- Similar domain has a low score
- Similar email has a low score
- Similar address has a high score
- Similar company has a high score
- Similar tech contact name has a low score
- Similar tech contact phone has a low score

Check the log file `data/[input-dir]/[log-dir]/license-scoring.csv` for more details.

#### Match results

At the end of this phase, we have a set of matched Licenses, which the engine calls uncreatively Related License Sets.

To use TypeScript to demonstrate this, at the end of this phase, we have:

```typescript
type RelatedLicenseSet = License[];

let matchedUp: RelatedLicenseSet[];
```

### Updating contacts based on matches

Now that we have matched sets, we can update HubSpot contacts more reliably.

In each matched group of licenses, we gather all the contacts based on their tech emails.

- We flag contacts via partner coworkers again, this time using these contacts.

Then, for each contact in each group, we set these fields, if configured via HubSpot ENV vras:

- License Tier is set to the highest one found in their group
- Last MPAC Event is set to the latest one found in their group
- Related Products has the app key added
- Deployment set has app hosting added to it

### Generating deals based on matches

The following logic all runs on each Related License Set.

During this phase, generated events and actions are saved for inspection in `data/[input-dir]/[log-dir]/deal-generator.txt`. Examining this file after a local run will help make sense of what this phase is doing and how it works.

#### Generating Events

First, the deal generator normalizes all the MPAC records in the set, into a series of "events".

- If it's an eval or an open source license, it's an "eval"
- If it's a paid license, or a transaction, it's a "purchase"
- If it's a transaction with sale type Renewal, it's a "renewal"
- If it's a transaction with sale type Upgrade, it's an "upgrade"

Now that we have a list of events for a group of records, we normalize it so that every event reflects some potential *separate* action to be taken by the deal generator.

- We merge all evals into the following purchase.
- If it's only evals, we merge all evals into one.
- Delete any trailing evals not followed by purchase.

Now we have a list of events where each one will correspond to a create/update deal action.

As part of this phase's normalization, we also *apply* refunds to in-memory MPAC records, by removing ones that have been refunded, and reducing amounts of those that have been partially refunded.

#### Generating Actions

##### Eval events

- Create or update deal
- DealStage = Eval, or Closed-Lost if inactive
- Set all properties

##### Purchase events

- Create or update deal
- DealStage = Closed-Won if creating or deal was Eval
- Set all properties

##### Renewal events

- Create or update deal
- DealStage = Closed-Won if creating
- Set all properties

##### Upgrade events

- Same as Renewal

##### Refund events

- Find all deals for transactions this has refunded
- For any that exist, and aren't Closed-Lost:
  - DealStage = Closed-Lost
  - Set all properties

### Applying Actions

If it's a create-deal action, we create it.

Whether we created or updated the deal, we now associate all contacts and companies with this deal:

1. Get all contacts via MPAC records in the Related License Set
2. Add all these contacts to the deal
3. Of the customer contacts, add their companies to the deal

### Upsyncing all changes to HubSpot

- All entities are created or updated in HubSpot.
- Then all associations are created or removed.

Finally, a convenient summary of some engine run details is printed to console.
