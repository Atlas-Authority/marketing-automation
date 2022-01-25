import DataDir from '../../data/dir';
import { ConsoleLogger } from '../../log/console';
import { License } from '../../marketplace/model/license';
import { sorter } from '../../util/helpers';
import { Engine } from '../engine';
import { LicenseMatcher, ScorableLicense } from './license-matcher';
import { LicenseMatchLogger } from './score-logger';

/** Related via the matching engine. */
export type RelatedLicenseSet = License[];

export class LicenseGrouper {

  private matchGroups = new Map<License, Set<License>>();

  constructor(private log: ConsoleLogger | null, private engine: Engine) { }

  run(logDir: DataDir | null): RelatedLicenseSet[] {
    return this.withLog(logDir, scoreLogger => {
      const threshold = 130;
      const scorer = new LicenseMatcher(threshold, scoreLogger);
      this.matchLicenses(scorer, scoreLogger);

      const matches = (Array.from(new Set(this.matchGroups.values()))
        .map(group => Array.from(group)
          .sort(sorter(license => license.data.maintenanceStartDate))));

      if (logDir) this.logMatchResults(logDir, matches);

      this.log?.info('Scoring Engine', 'Done');

      return matches;
    });
  }

  private withLog<T>(logDir: DataDir | null, fn: (logger: LicenseMatchLogger | undefined) => T) {
    if (logDir) {
      return logDir.file('license-scoring.csv').writeCsvStream(stream => {
        const scoreLogger = new LicenseMatchLogger(stream);
        const result = fn(scoreLogger);
        return result;
      });
    }
    else {
      return fn(undefined);
    }
  }

  private logMatchResults(logDir: DataDir, matches: License[][]) {
    const groups = matches.map(group => group.map(shorterLicenseInfo));

    logDir.file('matched-groups-all.csv').writeCsvStream(allMatchGroupsLog => {
      logDir.file('matched-groups-to-check.csv').writeCsvStream(checkMatchGroupsLog => {
        for (const match of groups) {
          for (const shortLicense of match) {
            allMatchGroupsLog.writeObjectRow(shortLicense);
          }
          allMatchGroupsLog.writeBlankRow();

          if (match.length > 1 && (
            !match.every(item => item.tech_email === match[0].tech_email) ||
            !match.every(item => item.company === match[0].company) ||
            !match.every(item => item.tech_address === match[0].tech_address)
          )) {
            for (const shortLicense of match) {
              checkMatchGroupsLog.writeObjectRow(shortLicense);
            }
            checkMatchGroupsLog.writeBlankRow();
          }
        }
      });
    });
  }

  private groupLicensesByProduct() {
    this.log?.info('Scoring Engine', 'Grouping licenses/transactions by hosting and addonKey');
    const productMapping = new Map<string, {
      license: License,
      scorable: ScorableLicense,
    }[]>();

    for (const license of this.engine.licenses) {
      const addonKey = license.data.addonKey;
      const hosting = license.data.hosting;
      const key = `${addonKey}, ${hosting}`;

      let list = productMapping.get(key);
      if (!list) productMapping.set(key, list = []);

      const [techContactEmailPart, techContactDomain] = license.techContact.data.email.split('@');

      const NON_EMPTY_FIELD = /[A-Za-z0-9]/;
      const normalizeString = (s: string | undefined) => s && NON_EMPTY_FIELD.test(s) ? s : '';

      list.push({
        license,
        scorable: {
          momentStarted: new Date(license.data.maintenanceStartDate).getTime(),
          momentEnded: new Date(license.data.maintenanceEndDate).getTime(),

          techContact: license.techContact,
          billingContact: license.billingContact,

          company: normalizeString(license.data.company)?.toLowerCase(),
          companyDomain: this.engine.freeEmailDomains.has(techContactDomain) ? '' : normalizeString(techContactDomain),

          techContactEmailPart,
          techContactAddress: normalizeString(license.data.technicalContact.address1)?.toLowerCase(),
          techContactName: normalizeString(license.data.technicalContact.name)?.toLowerCase(),
          techContactPhone: normalizeString(license.data.technicalContact.phone)?.toLowerCase(),
        },
      });
    }

    return productMapping;
  }

  private matchLicenses(scorer: LicenseMatcher, scoreLogger?: LicenseMatchLogger) {
    this.log?.info('Scoring Engine', 'Scoring licenses within [addonKey + hosting] groups');
    const startTime = process.hrtime.bigint();

    const productGroups = this.groupLicensesByProduct();

    for (const [name, group] of productGroups) {
      this.log?.info('Scoring Engine', `  Scoring [${name}]`);

      for (let i1 = 0; i1 < group.length; i1++) {
        for (let i2 = i1 + 1; i2 < group.length; i2++) {
          const license1 = group[i1];
          const license2 = group[i2];

          this.initMatch(license1.license);
          this.initMatch(license2.license);

          scoreLogger?.beginGroup(license1.license, license2.license);
          const didMatch = scorer.isSimilarEnough(license1.scorable, license2.scorable);
          scoreLogger?.endGroup();

          if (didMatch) {
            this.joinMatches(license1.license, license2.license);
          }
        }
      }
    }

    const endTime = process.hrtime.bigint();
    this.log?.info('Scoring Engine', `Total time: ${timeAsMinutesSeconds(endTime - startTime)}`);
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
  }

}


export function shorterLicenseInfo(license: License) {
  return {
    id: license.id,

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
