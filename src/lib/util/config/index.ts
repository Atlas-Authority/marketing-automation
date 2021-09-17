import _ from 'lodash';
import { optional, required } from './helpers.js';
export { DealStage, Pipeline } from './dynamic-enums.js';

export enum LogLevel {
  Error,
  Warn,
  Info,
  Verbose,
}

export const ADDONKEY_TO_PLATFORM: { [addonKey: string]: string } = Object.fromEntries(
  required('ADDONKEY_PLATFORMS')
    .split(',')
    .map(kv => kv.split('='))
);

export default {
  logLevel: logLevelFromString(optional('LOGLEVEL')?.trim().toLowerCase() || 'info'),
  mpac: {
    user: required('MPAC_USER'),
    pass: required('MPAC_PASS'),
    sellerId: required('MPAC_SELLER_ID'),
  },
  hubspot: {
    apiKey: required('HUBSPOT_API_KEY'),
    attrs: {
      deal: {
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
    partnerDomains: _.uniq(required('PARTNER_DOMAINS').split(/\s*,\s*/g)),
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

function logLevelFromString(level: string) {
  switch (level) {
    case 'error': return LogLevel.Error;
    case 'warn': return LogLevel.Warn;
    case 'info': return LogLevel.Info;
    case 'verbose': return LogLevel.Verbose;
    default: return LogLevel.Warn;
  }
}
