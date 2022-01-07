import Chance from 'chance';
import 'source-map-support/register';
import { License } from '../../model/license';
import { ContactInfo, PartnerInfo } from '../../model/marketplace/common';
import { Transaction } from '../../model/transaction';


export function redactedLicense(t: License): License {
  return new License({
    addonLicenseId: t.data.addonLicenseId,
    appEntitlementId: t.data.addonLicenseId,
    appEntitlementNumber: t.data.addonLicenseId,

    licenseId: t.data.licenseId,
    addonKey: Redact.addonKey(t.data.addonKey),
    addonName: Redact.addonName(t.data.addonName),
    lastUpdated: t.data.lastUpdated,

    technicalContact: redactContactInfo(t.data.technicalContact),
    billingContact: maybeRedactContactInfo(t.data.billingContact),
    partnerDetails: redactPartnerDetails(t.data.partnerDetails),

    company: Redact.company(t.data.company),
    country: Redact.country(t.data.country),
    region: Redact.region(t.data.region),

    tier: 'Unlimited Users',
    licenseType: t.data.licenseType,
    hosting: t.data.hosting,
    maintenanceStartDate: t.data.maintenanceStartDate,
    maintenanceEndDate: t.data.maintenanceEndDate,

    status: t.data.status,

    evaluationOpportunitySize: 'NA',
    attribution: null,
    parentInfo: null,
    newEvalData: null,
  });
}

export function redactedTransaction(t: Transaction): Transaction {
  return new Transaction({
    addonLicenseId: t.data.addonLicenseId,
    appEntitlementId: t.data.addonLicenseId,
    appEntitlementNumber: t.data.addonLicenseId,

    licenseId: t.data.licenseId,
    addonKey: Redact.addonKey(t.data.addonKey),
    addonName: Redact.addonName(t.data.addonName),
    lastUpdated: t.data.lastUpdated,

    technicalContact: redactContactInfo(t.data.technicalContact),
    billingContact: maybeRedactContactInfo(t.data.billingContact),
    partnerDetails: redactPartnerDetails(t.data.partnerDetails),

    company: Redact.company(t.data.company),
    country: Redact.country(t.data.country),
    region: Redact.region(t.data.region),

    tier: 'Unlimited Users',
    licenseType: t.data.licenseType,
    hosting: t.data.hosting,
    maintenanceStartDate: t.data.maintenanceStartDate,
    maintenanceEndDate: t.data.maintenanceEndDate,

    transactionId: t.data.transactionId,
    saleDate: t.data.saleDate,
    saleType: t.data.saleType,

    billingPeriod: t.data.billingPeriod,

    purchasePrice: Redact.amount(t.data.purchasePrice),
    vendorAmount: Redact.amount(t.data.vendorAmount),
  });
}

const Redact = {

  amount: makeRedactor<number>((old, chance) => {
    return chance.integer({ min: 1, max: 1000 });
  }, false),

  addonKey: makeRedactor<string>((old, chance) => {
    return chance.word({ capitalize: false });
  }),

  addonName: makeRedactor<string>((old, chance) => {
    return chance.word({ capitalize: true });
  }),

  company: makeRedactor<string>((old, chance) => {
    return chance.company();
  }),

  country: makeRedactor<string>((old, chance) => {
    return chance.country();
  }),

  region: makeRedactor<string>((old, chance) => {
    return chance.pickone(['EMEA', 'Americas', 'APAC', 'Unknown']);
  }),

  name: makeRedactor<string>((old, chance) => {
    return chance.name();
  }),

  email: makeRedactor<string>((old, chance) => {
    return chance.email();
  }),

};

function redactPartnerDetails(info: PartnerInfo | null): PartnerInfo | null {
  return (info
    ? {
      billingContact: {
        email: Redact.email(info.billingContact.email),
        name: Redact.email(info.billingContact.name),
      },
      partnerName: Redact.name(info.partnerName),
      partnerType: info.partnerType,
    } : null);
}

function makeRedactor<T>(fn: (old: T, chance: Chance.Chance) => T, mustBeUnique = true) {
  const chance = new Chance();
  const redactions = new Map<T, T>();
  return (old: T): T => {
    if (!old) return old;
    let redacted = redactions.get(old);
    if (redacted === undefined) {
      do { redacted = fn(old, chance); }
      while (mustBeUnique && redactions.has(redacted));
      redactions.set(old, redacted);
    }
    return redacted;
  };
}

function redactContactInfo(contact: ContactInfo): ContactInfo {
  return {
    email: Redact.email(contact.email),
    name: (contact.name
      ? Redact.name(contact.name)
      : contact.name),
  };
}

function maybeRedactContactInfo(contact: ContactInfo | null): ContactInfo | null {
  return (contact
    ? redactContactInfo(contact)
    : null);
}
