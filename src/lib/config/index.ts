import assert from 'assert';
import * as dotenv from 'dotenv';

dotenv.config();

export const ADDONKEY_TO_PLATFORM: { [addonKey: string]: string } = Object.fromEntries(
  required('ADDONKEY_PLATFORMS')
    .split(',')
    .map(kv => kv.split('='))
);

export default {
  mpac: {
    user: required('MPAC_USER'),
    pass: required('MPAC_PASS'),
    sellerId: required('MPAC_SELLER_ID'),
  },
  hubspot: {
    pipeline: {
      mpac: required('HUBSPOT_PIPELINE_MPAC'),
    },
    dealstage: {
      eval: required('HUBSPOT_DEALSTAGE_EVAL'),
      closedWon: required('HUBSPOT_DEALSTAGE_CLOSED_WON'),
      closedLost: required('HUBSPOT_DEALSTAGE_CLOSED_LOST'),
    },
    apiKey: required('HUBSPOT_API_KEY'),
    attrs: {
      contact: {
        deployment: required('HUBSPOT_CONTACT_DEPLOYMENT_ATTR'),
        products: required('HUBSPOT_CONTACT_PRODUCTS_ATTR'),
      },
      deal: {
        app: required('HUBSPOT_DEAL_APP_ATTR'),
        deployment: required('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
        addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
        transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
      },
    },
  },
  slack: {
    apiToken: required('SLACK_API_TOKEN'),
    errorPrefix: optional('SLACK_ERROR_PREFIX'),
    errorChannelId: optional('SLACK_ERROR_CHANNEL_ID'),
  },
  engine: {
    runInterval: required('RUN_INTERVAL'),
    retryInterval: required('RETRY_INTERVAL'),
    retryTimes: +required('RETRY_TIMES'),
    partnerDomains: new Set(required('PARTNER_DOMAINS').split(/\s*,\s*/g)),
    ignoredApps: new Set(optional('IGNORED_APPS')?.split(',') ?? []),
  },
  constants: {
    dealOrigin: required('DEAL_ORIGIN'),
    dealRelatedProducts: required('DEAL_RELATED_PRODUCTS'),
    dealDealName: required('DEAL_DEALNAME'),
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
