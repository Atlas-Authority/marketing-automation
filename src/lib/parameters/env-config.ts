import assert from "assert";
import dotenv from "dotenv";
import { HubspotCreds, MpacCreds } from "./interfaces";

dotenv.config();

export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

export interface Config {
  partnerDomains: string[];
}

export function serviceCredsFromENV() {
  return {

    mpacCreds: {
      user: required('MPAC_USER'),
      apiKey: required('MPAC_API_KEY'),
      sellerId: required('MPAC_SELLER_ID'),
    } as MpacCreds,

    hubspotCreds: requireOneOf([
      { accessToken: 'HUBSPOT_ACCESS_TOKEN' },
      { apiKey: 'HUBSPOT_API_KEY' },
    ]) as HubspotCreds,

  }
}

const env = {
  mpac: {
    platforms: Object.fromEntries<string>(
      required('ADDONKEY_PLATFORMS')
        .split(',')
        .map(kv => kv.split('=') as [string, string])
    ),
  },

  hubspot: {
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
        lastAssociatedPartner: optional('HUBSPOT_CONTACT_LAST_ASSOCIATED_PARTNER'),
      },
      deal: {
        app: optional('HUBSPOT_DEAL_APP_ATTR'),
        origin: optional('HUBSPOT_DEAL_ORIGIN_ATTR'),
        country: optional('HUBSPOT_DEAL_COUNTRY_ATTR'),
        deployment: optional('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
        addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
        transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
        licenseTier: optional('HUBSPOT_DEAL_LICENSE_TIER_ATTR'),
        relatedProducts: optional('HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR'),
        associatedPartner: optional('HUBSPOT_DEAL_ASSOCIATED_PARTNER'),
      },
    },
  },

  slack: {
    apiToken: optional('SLACK_API_TOKEN'),
    errorChannelId: optional('SLACK_ERROR_CHANNEL_ID'),
  },

  loop: {
    runInterval: required('RUN_INTERVAL'),
    retryInterval: required('RETRY_INTERVAL'),
    retryTimes: +required('RETRY_TIMES'),
  },

  engine: {
    partnerDomains: optional('PARTNER_DOMAINS')?.split(/\s*,\s*/g),
    archivedApps: new Set(optional('IGNORED_APPS')?.split(',') ?? []),
    ignoredEmails: new Set((optional('IGNORED_EMAILS')?.split(',') ?? []).map(e => e.toLowerCase())),
  },
};

export default env;

export const emptyConfig: Config = {
  partnerDomains: [],
};

export const envConfig: Config = {
  partnerDomains: env.engine.partnerDomains ?? [],
};

function required(key: string) {
  const value = process.env[key];
  if (isTest) return value ?? '';
  assert.ok(value, `ENV key ${key} is required`);
  return value;
}

function optional(key: string) {
  return process.env[key];
}

function requireOneOf<T>(opts: T[]): T {
  const all = opts.flatMap(opt => Object.entries(opt).map(([localKey, envKey]) => ({
    localKey,
    envKey,
    value: process.env[envKey],
  })));

  const firstValid = all.find(opt => opt.value);
  assert.ok(firstValid, `One of ENV keys ${all.map(o => o.envKey).join(' or ')} are required`);

  const { localKey, value } = firstValid;
  return { [localKey]: value } as unknown as T;
}
