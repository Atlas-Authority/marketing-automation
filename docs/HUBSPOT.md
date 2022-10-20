# HubSpot Setup

## Required Fields

Add any of these fields in HubSpot, and assign their internal IDs to an ENV var:

### Contacts

| Field                   | Type        | Allowed Values                | ENV var                                   | Required |
| ----------------------- | ----------- | ----------------------------- | ----------------------------------------- | -------- |
| License Tier            | Number      | *                             | `HUBSPOT_CONTACT_LICENSE_TIER_ATTR`       | ❌        |
| Last MPAC Event         | Date        | *                             | `HUBSPOT_CONTACT_LAST_MPAC_EVENT_ATTR`    | ❌        |
| Contact Type            | 1-Select    | 'Partner' or 'Customer'       | `HUBSPOT_CONTACT_CONTACT_TYPE_ATTR`       | ❌        |
| Region                  | 1-Select    | "region" of MPAC records      | `HUBSPOT_CONTACT_REGION_ATTR`             | ❌        |
| Related Products        | N-Select    | `ADDONKEY_PLATFORMS` rhs vals | `HUBSPOT_CONTACT_RELATED_PRODUCTS_ATTR`   | ❌        |
| Products                | N-Select    | "addonKey" of MPAC records    | `HUBSPOT_CONTACT_PRODUCTS_ATTR`           | ❌        |
| Deployment              | N-Select    | "hosting" of MPAC records     | `HUBSPOT_CONTACT_DEPLOYMENT_ATTR`         | ❌        |
| Last Associated Partner | 1-line Text | Valid domains                 | `HUBSPOT_CONTACT_LAST_ASSOCIATED_PARTNER` | ❌        |


### Deals

| Field                | Type        | Allowed Values                              | ENV var                                  | Required |
| -------------------- | ----------- | ------------------------------------------- | ---------------------------------------- | -------- |
| License Tier         | Number      | *                                           | `HUBSPOT_DEAL_LICENSE_TIER_ATTR`         | ❌        |
| Related Products     | 1-Select    | `DEAL_RELATED_PRODUCTS`                     | `HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR`     | ❌        |
| Origin               | 1-Select    | `DEAL_ORIGIN`                               | `HUBSPOT_DEAL_ORIGIN_ATTR`               | ❌        |
| Deployment           | 1-Select    | "hosting" of MPAC records                   | `HUBSPOT_DEAL_DEPLOYMENT_ATTR`           | ❌        |
| App                  | 1-Select    | "addonKey" of MPAC records                  | `HUBSPOT_DEAL_APP_ATTR`                  | ❌        |
| Country              | 1-line Text | "country" of MPAC records                   | `HUBSPOT_DEAL_COUNTRY_ATTR`              | ❌        |
| Associated Partner   | 1-line Text | Valid domains                               | `HUBSPOT_DEAL_ASSOCIATED_PARTNER`        | ❌        |
| Duplicate Of         | 1-line Text | ID of primary Deal                          | `HUBSPOT_DEAL_DUPLICATEOF_ATTR`          | ❌        |
| Maintenance End Date | Date        | "maintenanceEndDate" of MPAC records        | `HUBSPOT_DEAL_MAINTENANCE_END_DATE_ATTR` | ❌        |
| AddonLicenseId       | 1-line Text | (for engine use)                            | `HUBSPOT_DEAL_ADDONLICENESID_ATTR`       | ✔️        |
| TransactionId        | 1-line Text | (for engine use)                            | `HUBSPOT_DEAL_TRANSACTIONID_ATTR`        | ✔️        |
| AppEntitlementId     | 1-line Text | (for engine use)                            | `HUBSPOT_DEAL_APPENTITLEMENTID_ATTR`     | ✔️        |
| AppEntitlementNumber | 1-line Text | (for engine use)                            | `HUBSPOT_DEAL_APPENTITLEMENTNUMBER_ATTR` | ✔️        |
| Sale Type            | 1-Select    | "saleType" of MPAC records, but no 'Refund' | `HUBSPOT_DEAL_SALE_TYPE_ATTR`            | ❌        |

## Managed Fields

Managed fields are HubSpot fields that the Marketing Automation Engine may only update if the field is currently empty.

The purpose of managed fields is to allow manual data cleanup/sanitation, after the engine creates HubSpot entities.

For example, if Contact.FirstName is managed:

* When creating a contact, first name will be set
* When updating a contact:
  * If first name is blank, first name will be set
  * If first name is already set, first name will not be updated

See the sample .env file for how to set managed fields via ENV variables.

## Custom Association Types

HubSpot allows custom association types, for example, a Partner can be an association between a Company and a Contact.

This project supports custom association types via an ENV variable, using the following format derivation rules:

* The ENV variable is `HUBSPOT_ASSOCIATION_TYPE_MAPPINGS`
* The format must be `partner=company_to_contact,[...]`
* The format allows for multiple comma-separated mappings
* The left hand side of each mapping (e.g. `partner` or `board_member`) is derived via:
  * Take the name of the custom association, e.g. `Board Member`
  * Lower-case it, e.g. `board member`
  * Replace spaces with underscores, e.g. `board_member`
* The right hand side of each mapping (e.g. `company_to_contact`) is derived via:
  * Take the names of both entity types in the association (e.g. `Contact` and `Company`)
  * Apply the same rules as the LHS above (e.g. `contact` and `company`)
  * Join them with the string `_to_` (e.g. `contact_to_company`)
  * Note: the order does not matter in this mapping (e.g. `company_to_contact` is equivalent to the above)
