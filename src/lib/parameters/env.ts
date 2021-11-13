import assert from 'assert';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  mpac: {
    user: required('MPAC_USER'),
    pass: required('MPAC_PASS'),
    sellerId: required('MPAC_SELLER_ID'),
    platforms: Object.fromEntries<string>(
      required('ADDONKEY_PLATFORMS')
        .split(',')
        .map(kv => kv.split('=') as [string, string])
    ),
  },
  hubspot: {
    apiKey: required('HUBSPOT_API_KEY'),
    accountId: optional('HUBSPOT_ACCOUNT_ID'),
    pipeline: {
      mpac: required('HUBSPOT_PIPELINE_MPAC'),
    },
    dealstage: {
      eval: required('HUBSPOT_DEALSTAGE_EVAL'),
      closedWon: required('HUBSPOT_DEALSTAGE_CLOSED_WON'),
      closedLost: required('HUBSPOT_DEALSTAGE_CLOSED_LOST'),
    },
    deals: {
      dealOrigin: optional('DEAL_ORIGIN'),
      dealRelatedProducts: optional('DEAL_RELATED_PRODUCTS'),
      dealDealName: required('DEAL_DEALNAME'),
    },
    attrs: {
      contact: {
        deployment: optional('HUBSPOT_CONTACT_DEPLOYMENT_ATTR'),
        licenseTier: optional('HUBSPOT_CONTACT_LICENSE_TIER_ATTR'),
        products: optional('HUBSPOT_CONTACT_PRODUCTS_ATTR'),
        lastMpacEvent: optional('HUBSPOT_CONTACT_LAST_MPAC_EVENT_ATTR'),
        contactType: optional('HUBSPOT_CONTACT_CONTACT_TYPE_ATTR'),
        region: optional('HUBSPOT_CONTACT_REGION_ATTR'),
        relatedProducts: optional('HUBSPOT_CONTACT_RELATED_PRODUCTS_ATTR'),
      },
      deal: {
        app: optional('HUBSPOT_DEAL_APP_ATTR'),
        deployment: optional('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
        addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
        transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
        licenseTier: optional('HUBSPOT_DEAL_LICENSE_TIER_ATTR'),
        relatedProducts: optional('HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR'),
      },
    },
  },
  slack: {
    apiToken: optional('SLACK_API_TOKEN'),
    errorChannelId: optional('SLACK_ERROR_CHANNEL_ID'),
  },
  engine: {
    runInterval: required('RUN_INTERVAL'),
    retryInterval: required('RETRY_INTERVAL'),
    retryTimes: +required('RETRY_TIMES'),
    partnerDomains: new Set(optional('PARTNER_DOMAINS')?.split(/\s*,\s*/g) ?? []),
    ignoredApps: new Set(optional('IGNORED_APPS')?.split(',') ?? []),
    ignoredEmails: new Set((optional('IGNORED_EMAILS')?.split(',') ?? []).map(e => e.toLowerCase())),
  },
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

function required(key: string) {
  const value = process.env[key];
  assert.ok(value, `ENV key ${key} is required`);
  return value;
}

function optional(key: string) {
  return process.env[key];
}
