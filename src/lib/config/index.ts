import { optional, required } from './helpers.js';
export { DealStage, Pipeline } from './dynamic-enums.js';

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
    apiKey: required('HUBSPOT_API_KEY'),
    attrs: {
      contact: {
        deployment: optional('HUBSPOT_CONTACT_DEPLOYMENT_ATTR'),
        products: optional('HUBSPOT_CONTACT_PRODUCTS_ATTR'),
      },
      deal: {
        app: optional('HUBSPOT_DEAL_APP_ATTR'),
        deployment: optional('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
        addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
        transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
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
  },
  constants: {
    dealOrigin: optional('DEAL_ORIGIN'),
    dealRelatedProducts: optional('DEAL_RELATED_PRODUCTS'),
    dealDealName: required('DEAL_DEALNAME'),
  },
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
