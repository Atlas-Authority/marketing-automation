import assert from 'assert';
import * as dotenv from 'dotenv';
import _ from 'lodash';

dotenv.config();

/** @enum {string} */
export const Pipeline = {
  AtlassianMarketplace: required('HUBSPOT_PIPELINE_MPAC'),
};

/** @enum {string} */
export const DealStage = {
  EVAL: required('HUBSPOT_DEALSTAGE_EVAL'),
  CLOSED_WON: required('HUBSPOT_DEALSTAGE_CLOSED_WON'),
  CLOSED_LOST: required('HUBSPOT_DEALSTAGE_CLOSED_LOST'),
};

/** @type {{ [addonKey: string]: string }} */
export const ADDONKEY_TO_PLATFORM = Object.fromEntries(
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
    fns: /** @type {string[]} */([]),
  },
  constants: {
    dealOrigin: required('DEAL_ORIGIN'),
    dealRelatedProducts: required('DEAL_RELATED_PRODUCTS'),
  },
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

/**
 * @param {string} key
 */
function required(key) {
  const value = process.env[key];
  assert.ok(value, `ENV key ${key} is required`);
  return value;
}

/**
 * @param {string} key
 */
function optional(key) {
  return process.env[key];
}
