import { optional, required } from './helpers.js';
export { DealStage, Pipeline } from './dynamic-enums.js';

export enum LogLevel {
  Error,
  Warn,
  Info,
  Verbose,
  Detailed,
}

export const ADDONKEY_TO_PLATFORM: { [addonKey: string]: string } = Object.fromEntries(
  required('ADDONKEY_PLATFORMS')
    .split(',')
    .map(kv => kv.split('='))
);

export default {
  logLevel: LogLevel.Verbose,
  mpac: {
    user: required('MPAC_USER'),
    pass: required('MPAC_PASS'),
    sellerId: required('MPAC_SELLER_ID'),
  },
  hubspot: {
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
  },
  cache: {
    fns: [] as string[],
  },
  constants: {
    dealOrigin: required('DEAL_ORIGIN'),
    dealRelatedProducts: required('DEAL_RELATED_PRODUCTS'),
    dealDealName: required('DEAL_DEALNAME'),
  },
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
