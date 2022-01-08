import { License } from "../../model/license";
import { SimilarityScorer } from "./similarity-scorer";

const NINETY_DAYS_AS_MS = 1000 * 60 * 60 * 24 * 90;

export class LicenseMatcher {

  private similarityScorer = new SimilarityScorer();

  public constructor() { }

  public score(threshold: number, license1: License, license2: License): null | { item1: string, item2: string, score: number, reasons: string[] } {
    const item1 = license1.data.addonLicenseId;
    const item2 = license2.data.addonLicenseId;

    // Skip if over 90 days apart
    if (
      license2.momentStarted - license1.momentEnded > NINETY_DAYS_AS_MS ||
      license1.momentStarted - license2.momentEnded > NINETY_DAYS_AS_MS
    ) {
      return {
        item1,
        item2,
        reasons: ['too far apart'],
        score: -1000,
      };
    }

    const techContact1 = license1.techContact;
    const techContact2 = license2.techContact;

    const billingContact1 = license1.billingContact;
    const billingContact2 = license2.billingContact;

    // If same exact email, definitely a match
    if (
      (techContact1 === techContact2) ||
      (
        techContact1 === billingContact2 ||
        techContact2 === billingContact1
      ) ||
      (
        billingContact1 &&
        billingContact1 === billingContact2)
    ) {
      return {
        item1,
        item2,
        score: 1000,
        reasons: ['same contact'],
      };
    }

    let score = 0;
    let earlyResult;
    const reasons: string[] = [];

    const addressScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.address1?.toLowerCase(),
      license2.data.technicalContact.address1?.toLowerCase(),
    ));
    if (addressScore) {
      score += addressScore;
      reasons.push(`addressScore = ${addressScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 80 + 30 + 30 + 30 + 30))) return earlyResult;

    const companyScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.company?.toLowerCase(),
      license2.data.company?.toLowerCase(),
    ));
    if (companyScore) {
      score += companyScore;
      reasons.push(`companyScore = ${companyScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 30 + 30 + 30 + 30))) return earlyResult;

    const [emailAddress1, domain1] = techContact1.data.email.split('@');
    const [emailAddress2, domain2] = techContact2.data.email.split('@');

    if (techContact1.isCustomer) {
      const domainScore = Math.round(30 * this.similarityScorer.score(0.80,
        domain1.toLowerCase(),
        domain2.toLowerCase(),
      ));
      score += domainScore;
      reasons.push(`domainScore = ${domainScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 30 + 30 + 30))) return earlyResult;

    const emailAddressScore = Math.round(30 * this.similarityScorer.score(0.80,
      emailAddress1.toLowerCase(),
      emailAddress2.toLowerCase(),
    ));
    if (emailAddressScore) {
      score += emailAddressScore;
      reasons.push(`emailAddressScore = ${emailAddressScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 30 + 30))) return earlyResult;

    const techContactNameScore = Math.round(30 * this.similarityScorer.score(0.70,
      license1.data.technicalContact.name?.toLowerCase(),
      license2.data.technicalContact.name?.toLowerCase(),
    ));
    if (techContactNameScore) {
      score += techContactNameScore;
      reasons.push(`techContactNameScore = ${techContactNameScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 30))) return earlyResult;

    const techContactPhoneScore = Math.round(30 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.phone?.toLowerCase(),
      license2.data.technicalContact.phone?.toLowerCase(),
    ));
    if (techContactPhoneScore) {
      score += techContactPhoneScore;
      reasons.push(`techContactPhoneScore = ${techContactPhoneScore}`);
    }
    if (false !== (earlyResult = basicallyDone(item1, item2, reasons, threshold, score, 0))) return earlyResult;

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

function basicallyDone(item1: string, item2: string, reasons: string[], threshold: number, score: number, opportunities: number): false | null | { item1: string, item2: string, reasons: string[], score: number } {
  if (score >= threshold) return { item1, item2, reasons, score: 999 };
  if (score + opportunities < threshold) return (score === 0
    ? null
    : { item1, item2, reasons, score });
  return false;
}
