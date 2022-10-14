import assert from "assert";
import util from "util";
import { ConsoleLogger } from "../log/console";
import { License, LicenseData } from "../model/license";
import { Transaction } from "../model/transaction";
import { AttachableError } from '../util/errors';
import { detailedDiff } from "deep-object-diff";

export function removeApiBorderDuplicates(licenses: readonly License[]) {
  const groups: { [id: string]: License[] } = {};

  for (const license of licenses) {
    if (!groups[license.id]) {
      groups[license.id] = [license];
    }
    else if (!groups[license.id].some(other => util.isDeepStrictEqual(license, other))) {
      groups[license.id].push(license);
    }
  }

  // These are created at the very edge of the 2018-07-01 cutoff between with/without attributions
  const edgeCases = Object.values(groups).filter(ls => ls.length > 1);
  for (const dups of edgeCases) {
    const strippedDups = dups.map(dup => ({
      addonKey: dup.data.addonKey,
      addonName: dup.data.addonName,
      company: dup.data.company,
      country: dup.data.country,
      region: dup.data.region,
      technicalContact: dup.data.technicalContact,
      hosting: dup.data.hosting,
      licenseId: dup.data.licenseId,
      licenseType: dup.data.licenseType,
      maintenanceEndDate: dup.data.maintenanceEndDate,
      maintenanceStartDate: dup.data.maintenanceStartDate,
      tier: dup.data.tier,
      addonLicenseId: dup.data.addonLicenseId,
      appEntitlementId: dup.data.appEntitlementId,
      appEntitlementNumber: dup.data.appEntitlementNumber,
      partnerDetails: dup.data.partnerDetails,
    }));

    for (let i = 0; i < strippedDups.length - 1; i++) {
      const a = strippedDups[i];
      const b = strippedDups[i + 1];

      if (!util.isDeepStrictEqual(a, b)) {
        const diff = detailedDiff(a, b);
        const json = {
          data: a,
          diff,
        };
        throw new AttachableError('Duplicate deals found at API border', JSON.stringify(json, null, 2));
      }
    }

    // Keep the first one with attributions
    dups.sort((a, b) => a.data.evaluationOpportunitySize ? -1 : 1);
    assert.ok(dups[0].data.evaluationOpportunitySize);
    dups.length = 1;
  }

  const fixed = Object.values(groups);
  assert.ok(fixed.every(ls => ls.length === 1));

  return fixed.map(ls => ls[0]);
}

export function assertRequiredLicenseFields(license: License) {
  validateField(license, license => license.data.addonKey);
  validateField(license, license => license.data.addonName);
  validateField(license, license => license.data.lastUpdated);
  // validateField(license, license => license.data.company);
  validateField(license, license => license.data.country);
  validateField(license, license => license.data.region);
  validateField(license, license => license.data.technicalContact);
  validateField(license, license => license.data.technicalContact.email);
  validateField(license, license => license.data.tier);
  validateField(license, license => license.data.licenseType);
  validateField(license, license => license.data.hosting);
  validateField(license, license => license.data.maintenanceStartDate);
  validateField(license, license => license.data.maintenanceEndDate);
  validateField(license, license => license.data.status);
  validateField(license, license => license.data.partnerDetails?.billingContact, o => !o || typeof o.email === 'string');
}

export function assertRequiredTransactionFields(transaction: Transaction) {
  validateField(transaction, transaction => transaction.data.transactionId);
  validateField(transaction, transaction => transaction.data.addonKey);
  validateField(transaction, transaction => transaction.data.addonName);
  validateField(transaction, transaction => transaction.data.lastUpdated);
  validateField(transaction, transaction => transaction.data.company);
  validateField(transaction, transaction => transaction.data.country);
  validateField(transaction, transaction => transaction.data.region);
  validateField(transaction, transaction => transaction.data.technicalContact);
  validateField(transaction, transaction => transaction.data.technicalContact.email);
  validateField(transaction, transaction => transaction.data.saleDate);
  validateField(transaction, transaction => transaction.data.tier);
  validateField(transaction, transaction => transaction.data.licenseType);
  validateField(transaction, transaction => transaction.data.hosting);
  validateField(transaction, transaction => transaction.data.billingPeriod);
  validateField(transaction, transaction => transaction.data.purchasePrice, n => typeof n === 'number');
  validateField(transaction, transaction => transaction.data.vendorAmount, n => typeof n === 'number');
  validateField(transaction, transaction => transaction.data.saleType);
  validateField(transaction, transaction => transaction.data.maintenanceStartDate);
  validateField(transaction, transaction => transaction.data.maintenanceEndDate);
  validateField(transaction, transaction => transaction.data.partnerDetails?.billingContact, o => !o || typeof o.email === 'string');
}

function validateField<T extends Transaction | License, V>(o: T, accessor: (o: T) => V, validator: (o: V) => boolean = o => !!o) {
  const val = accessor(o);
  const path = accessor.toString().replace(/^(\w+) => /, '');
  if (!validator(val)) throw new AttachableError(`Missing field (in ${o.id}): ${path} (found ${JSON.stringify(val)})`, JSON.stringify(o, null, 2));
}

export function hasTechEmail(license: License, console?: ConsoleLogger) {
  if (!license.data.technicalContact?.email) {
    const id = license.id;
    console?.printWarning('MPAC', 'License does not have a tech contact email; will be skipped', id);
    return false;
  }
  return true;
}
