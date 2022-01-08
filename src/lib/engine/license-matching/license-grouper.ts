import { saveForInspection } from '../../cache/inspection';
import log from '../../log/logger';
import { Database } from '../../model/database';
import { License } from '../../model/license';
import { sorter } from '../../util/helpers';
import { LicenseMatcher } from './license-matcher';

/** Related via the matching engine. */
export type RelatedLicenseSet = License[];

export class LicenseGrouper {

  private matchGroups = new Map<License, Set<License>>();

  constructor(private db: Database) { }

  run(): RelatedLicenseSet[] {
    log.info('Scoring Engine', 'Grouping licenses/transactions by hosting and addonKey');
    const productGroups = this.groupLicensesByProduct();

    const threshold = 130;
    const scorer = new LicenseMatcher(threshold, this.db.providerDomains);
    this.matchLicenses(scorer, productGroups);
    const matches = new Set(this.matchGroups.values())

    saveForInspection('matched-groups-all',
      Array.from(matches)
        .map(group => Array.from(group)
          .map(l => shorterLicenseInfo(l))
          .sort(sorter(l => l.start))));

    saveForInspection('matched-groups-to-check',
      Array.from(matches)
        .map(group => Array.from(group)
          .map(l => shorterLicenseInfo(l))
          .sort(sorter(l => l.start)))
        .filter(group => (
          group.length > 1 &&
          (
            !group.every(item => item.tech_email === group[0].tech_email) ||
            !group.every(item => item.company === group[0].company) ||
            !group.every(item => item.tech_address === group[0].tech_address)
          )
        )));

    log.info('Scoring Engine', 'Done');

    const matchGroups = Array.from(matches)
      .map(group => Array.from(group)
        .sort(sorter(license => license.data.maintenanceStartDate)));

    return matchGroups;
  }

  private groupLicensesByProduct() {
    const productMapping = new Map<string, License[]>();

    for (const license of this.db.licensesByAddonLicenseId.values()) {
      const addonKey = license.data.addonKey;
      const hosting = license.data.hosting;
      const key = `${addonKey}, ${hosting}`;

      let list = productMapping.get(key);
      if (!list) productMapping.set(key, list = []);
      list.push(license);
    }

    return productMapping;

  }

  private matchLicenses(scorer: LicenseMatcher, productGroups: Map<string, License[]>) {
    log.info('Scoring Engine', 'Scoring licenses within [addonKey + hosting] groups');
    const startTime = process.hrtime.bigint();

    for (const [name, group] of productGroups) {
      log.info('Scoring Engine', `  Scoring [${name}]`);

      for (let i1 = 0; i1 < group.length; i1++) {
        for (let i2 = i1 + 1; i2 < group.length; i2++) {
          const license1 = group[i1];
          const license2 = group[i2];

          this.initMatch(license1);
          this.initMatch(license2);

          if (scorer.isSimilarEnough(license1, license2)) {
            this.joinMatches(license1, license2);
          }
        }
      }
    }

    const endTime = process.hrtime.bigint();
    log.info('Scoring Engine', `Total time: ${timeAsMinutesSeconds(endTime - startTime)}`);
  }

  private joinMatches(license1: License, license2: License) {
    const group1 = this.matchGroups.get(license1)!;
    const group2 = this.matchGroups.get(license2)!;
    const combinedGroup = new Set([...group1, ...group2]);
    for (const license of combinedGroup) {
      this.matchGroups.set(license, combinedGroup);
    }
  }

  private initMatch(license: License) {
    if (this.matchGroups.has(license)) return;

    this.matchGroups.set(license, new Set([license]));

    if (license.evaluatedTo) {
      this.initMatch(license.evaluatedTo);
      this.joinMatches(license.evaluatedTo, license);
    }

    if (license.evaluatedFrom) {
      this.initMatch(license.evaluatedFrom);
      this.joinMatches(license.evaluatedFrom, license);
    }
  }

}


export function shorterLicenseInfo(license: License) {
  return {
    addonLicenseId: license.data.addonLicenseId,

    company: license.data.company,

    tech_email: license.data.technicalContact.email,
    tech_name: license.data.technicalContact.name,
    tech_address: license.data.technicalContact.address1,
    tech_city: license.data.technicalContact.city,
    tech_phone: license.data.technicalContact.phone,
    tech_state: license.data.technicalContact.state,
    tech_zip: license.data.technicalContact.postcode,
    tech_country: license.data.country,
    tech_address2: license.data.technicalContact.address2,

    start: license.data.maintenanceStartDate,
    end: license.data.maintenanceEndDate,

    billing_email: license.data.billingContact?.email,
    partner_email: license.data.partnerDetails?.billingContact.email,
  };
}

function timeAsMinutesSeconds(ns: bigint) {
  const total = Number(ns / 1_000_000_000n);

  const m = Math.floor(total / 60);
  const s = total % 60;

  const mm = m.toFixed().padStart(2, '0');
  const ss = s.toFixed().padStart(2, '0');

  return `${mm}:${ss}`;
}
