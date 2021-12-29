## HubSpot Setup

Add any of these fields in HubSpot, and assign their internal IDs to an ENV var:

### Contacts

| Field                   | Type        | Allowed Values                           | ENV var                                   | Required |
| ----------------------- | ----------- | ---------------------------------------- | ----------------------------------------- | -------- |
| License Tier            | Number      | *                                        | `HUBSPOT_CONTACT_LICENSE_TIER_ATTR`       | ❌        |
| Last MPAC Event         | Date        | *                                        | `HUBSPOT_CONTACT_LAST_MPAC_EVENT_ATTR`    | ❌        |
| Contact Type            | 1-Select    | 'Partner' or 'Customer'                  | `HUBSPOT_CONTACT_CONTACT_TYPE_ATTR`       | ❌        |
| Region                  | 1-Select    | "region" of MPAC records                 | `HUBSPOT_CONTACT_REGION_ATTR`             | ❌        |
| Related Products        | N-Select    | `ADDONKEY_PLATFORMS` rhs vals            | `HUBSPOT_CONTACT_RELATED_PRODUCTS_ATTR`   | ❌        |
| Products                | N-Select    | "addonKey" of MPAC records               | `HUBSPOT_CONTACT_PRODUCTS_ATTR`           | ❌        |
| Deployment              | 1-Select    | "hosting" of MPAC records, or 'Multiple' | `HUBSPOT_CONTACT_DEPLOYMENT_ATTR`         | ❌        |
| Last Associated Partner | 1-line Text | Valid domains                            | `HUBSPOT_CONTACT_LAST_ASSOCIATED_PARTNER` | ❌        |


### Deals

| Field              | Type        | Allowed Values             | ENV var                              | Required |
| ------------------ | ----------- | -------------------------- | ------------------------------------ | -------- |
| License Tier       | Number      | *                          | `HUBSPOT_DEAL_LICENSE_TIER_ATTR`     | ❌        |
| Related Products   | 1-Select    | `DEAL_RELATED_PRODUCTS`    | `HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR` | ❌        |
| Origin             | 1-Select    | `DEAL_ORIGIN`              | `HUBSPOT_DEAL_ORIGIN_ATTR`           | ❌        |
| Deployment         | 1-Select    | "hosting" of MPAC records  | `HUBSPOT_DEAL_DEPLOYMENT_ATTR`       | ❌        |
| App                | 1-Select    | "addonKey" of MPAC records | `HUBSPOT_DEAL_APP_ATTR`              | ❌        |
| Country            | 1-line Text | "country" of MPAC records  | `HUBSPOT_DEAL_COUNTRY_ATTR`          | ❌        |
| AddonLicenseId     | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_ADDONLICENESID_ATTR`   | ✔️        |
| TransactionId      | 1-line Text | (for engine use)           | `HUBSPOT_DEAL_TRANSACTIONID_ATTR`    | ✔️        |
| Associated Partner | 1-line Text | Valid domains              | `HUBSPOT_DEAL_ASSOCIATED_PARTNER`    | ❌        |
