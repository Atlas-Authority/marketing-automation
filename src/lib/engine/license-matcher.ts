import { Database } from '../model/database.js';
import { License } from '../model/marketplace/license.js';
import { SimilarityScorer } from './similarity-scorer.js';

export class LicenseMatcher {

  similarityScorer = new SimilarityScorer();

  constructor(private db: Database) { }

  score(license1: License, license2: License): null | { item1: string, item2: string, score: number, reasons: string[] } {
    const item1 = license1.data.addonLicenseId;
    const item2 = license2.data.addonLicenseId;

    const techEmail1 = license1.data.technicalContact.email;
    const techEmail2 = license2.data.technicalContact.email;

    const billingEmail1 = license1.data.billingContact?.email;
    const billingEmail2 = license2.data.billingContact?.email;

    const contact1 = this.db.contactManager.getByEmail(techEmail1);
    const contact2 = this.db.contactManager.getByEmail(techEmail2);

    // Skip if over 90 days apart
    const dateGap = dateDiff(
      license1.data.maintenanceStartDate, license1.data.maintenanceEndDate,
      license2.data.maintenanceStartDate, license2.data.maintenanceEndDate
    );

    if (dateGap > 90) {
      return {
        item1,
        item2,
        reasons: ['too far apart'],
        score: -1000,
      };
    }

    // If same exact email, definitely a match
    if (
      (contact1 === contact2) ||
      (techEmail1 === techEmail2) ||
      (billingEmail1 && billingEmail1 === billingEmail2)
    ) {
      return {
        item1,
        item2,
        score: 1000,
        reasons: ['same contact'],
      };
    }

    if (
      techEmail1 === billingEmail2 ||
      techEmail2 === billingEmail1
    ) {
      return {
        item1,
        item2,
        score: 1000,
        reasons: ['same other-contact'],
      };
    }

    let score = 0;

    const reasons: string[] = [];

    const [emailAddress1, domain1] = techEmail1.split('@');
    const [emailAddress2, domain2] = techEmail2.split('@');

    if (!this.db.providerDomains.has(domain1)) {
      const domainScore = Math.round(30 * this.similarityScorer.score(0.80,
        domain1.toLowerCase(),
        domain2.toLowerCase(),
      ));
      score += domainScore;
      reasons.push(`domainScore = ${domainScore}`);
    }

    const emailAddressScore = Math.round(30 * this.similarityScorer.score(0.80,
      emailAddress1.toLowerCase(),
      emailAddress2.toLowerCase(),
    ));
    if (emailAddressScore) {
      score += emailAddressScore;
      reasons.push(`emailAddressScore = ${emailAddressScore}`);
    }

    const addressScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.address1?.toLowerCase(),
      license2.data.technicalContact.address1?.toLowerCase(),
    ));
    if (addressScore) {
      score += addressScore;
      reasons.push(`addressScore = ${addressScore}`);
    }

    const companyScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.company?.toLowerCase(),
      license2.data.company?.toLowerCase(),
    ));
    if (companyScore) {
      score += companyScore;
      reasons.push(`companyScore = ${companyScore}`);
    }

    const techContactNameScore = Math.round(30 * this.similarityScorer.score(0.70,
      license1.data.technicalContact.name?.toLowerCase(),
      license2.data.technicalContact.name?.toLowerCase(),
    ));
    if (techContactNameScore) {
      score += techContactNameScore;
      reasons.push(`techContactNameScore = ${techContactNameScore}`);
    }

    const techContactPhoneScore = Math.round(30 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.phone?.toLowerCase(),
      license2.data.technicalContact.phone?.toLowerCase(),
    ));
    if (techContactPhoneScore) {
      score += techContactPhoneScore;
      reasons.push(`techContactPhoneScore = ${techContactPhoneScore}`);
    }

    if (score > 0) {
      return {
        item1,
        item2,
        score,
        reasons,
      };
    }

    return null;
  }

}

const DATEDIFF_CACHE = new Map<string, number>();

function dateDiff(a1: string, a2: string, b1: string, b2: string) {
  if (!DATEDIFF_CACHE.has(a1)) DATEDIFF_CACHE.set(a1, new Date(a1).getTime());
  if (!DATEDIFF_CACHE.has(a2)) DATEDIFF_CACHE.set(a2, new Date(a2).getTime());
  if (!DATEDIFF_CACHE.has(b1)) DATEDIFF_CACHE.set(b1, new Date(b1).getTime());
  if (!DATEDIFF_CACHE.has(b2)) DATEDIFF_CACHE.set(b2, new Date(b2).getTime());

  const d_a1 = DATEDIFF_CACHE.get(a1) as number;
  const d_a2 = DATEDIFF_CACHE.get(a2) as number;
  const d_b1 = DATEDIFF_CACHE.get(b1) as number;
  const d_b2 = DATEDIFF_CACHE.get(b2) as number;

  if (d_a1 > d_b2) return (d_a1 - d_b2) / 1000 / 60 / 60 / 24;
  if (d_b1 > d_a2) return (d_b1 - d_a2) / 1000 / 60 / 60 / 24;
  return 0;
}
