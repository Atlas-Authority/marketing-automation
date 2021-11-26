# Engine logic

See the [README](./README.md) for a high-level overview of each engine run.

The following sections describe those high-level steps, in order, in full semantic detail.

### Downloading data to operate on

The engine downloads:

- All HubSpot Deals with Pipeline=MPAC
- All HubSpot Contacts
- All HubSpot Companies
- All MPAC Licenses
- All MPAC Transactions

It then transforms all these into in-memory representations to more easily work with: mutable HubSpot entities and immutable MPAC records.

These in-memory HubSpot entities will be operated on throughout the rest of the engine run, and upsynced in the final step.

### Identifying contact types by MPAC data

The two types of contact types are Partner and Customer. This phase identifies all known domains as being one or the other.

The initial source of this info is domains in MPAC contacts. If a domain is in a partner contact, then it's a partner domain, and any other contact with the same domain is also a partner contact.

We also add partner domains from an optional ENV variable if you have some you know for sure to be partners.

We remove from the partners list any mass email providers such as gmail and hotmail, and all known burner (throwaway) email providers. A list of such domains is gathered from 3 different sources:

1. The NPM lib `burner-email-providers`
2. The NPM lib `email-providers`
3. The URL `https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`

After all this, we finally have a set of domains that are known to be Partners. The rest are Contacts.

Now we just flag all contacts, if their domain is in one of these two sets, as having that contact type.

We also flag all contacts in the same HubSpot Company as a partner as also being partners. (We don't mark their domains as being Partner domains.)

### Generating contacts

Each MPAC record is used to lookup an existing HubSpot Contact and potentially update it, or generate a new one.

(Coming soon.)

### Matching MPAC events

(Coming soon.)

### Updating contacts based on matches

(Coming soon.)

### Generating deals based on matches

(Coming soon.)

### Upsyncing all changes to HubSpot

(Coming soon.)
