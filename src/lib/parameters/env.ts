import assert from "assert";
import dotenv from "dotenv";

dotenv.config();

class Env {

  get mpac() {
    return {
      user: required('MPAC_USER'),
      apiKey: required('MPAC_API_KEY'),
      sellerId: required('MPAC_SELLER_ID'),
      platforms: Object.fromEntries<string>(
        required('ADDONKEY_PLATFORMS')
          .split(',')
          .map(kv => kv.split('=') as [string, string])
      ),
    };
  }

  get hubspot() {
    return {
      ...requireOneOf([
        { accessToken: 'HUBSPOT_ACCESS_TOKEN' },
        { apiKey: 'HUBSPOT_API_KEY' },
      ]),
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
          origin: optional('HUBSPOT_DEAL_ORIGIN_ATTR'),
          country: optional('HUBSPOT_DEAL_COUNTRY_ATTR'),
          deployment: optional('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
          addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
          transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
          licenseTier: optional('HUBSPOT_DEAL_LICENSE_TIER_ATTR'),
          relatedProducts: optional('HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR'),
        },
      },
    };
  }

  get slack() {
    return {
      apiToken: optional('SLACK_API_TOKEN'),
      errorChannelId: optional('SLACK_ERROR_CHANNEL_ID'),
    };
  }

  get engine() {
    return {
      runInterval: required('RUN_INTERVAL'),
      retryInterval: required('RETRY_INTERVAL'),
      retryTimes: +required('RETRY_TIMES'),
      partnerDomains: new Set(optional('PARTNER_DOMAINS')?.split(/\s*,\s*/g) ?? []),
      ignoredApps: new Set(optional('IGNORED_APPS')?.split(',') ?? []),
      ignoredEmails: new Set((optional('IGNORED_EMAILS')?.split(',') ?? []).map(e => e.toLowerCase())),
    };
  }

  get isProduction() { return process.env.NODE_ENV === 'production'; }
  get isTest() { return process.env.NODE_ENV === 'test'; }

}

export default new Env();

function required(key: string) {
  const value = process.env[key];
  if (process.env.NODE_ENV === 'test') return value ?? '';
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
  if (process.env.NODE_ENV === 'test') return opts[0];
  assert.ok(firstValid, `One of ENV keys ${all.map(o => o.envKey).join(' or ')} are required`);

  const { localKey, value } = firstValid;
  return { [localKey]: value } as unknown as T;
}
