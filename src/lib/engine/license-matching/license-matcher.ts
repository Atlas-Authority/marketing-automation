import { License } from "../../model/license";
import { SimilarityScorer } from "./similarity-scorer";

const NINETY_DAYS_AS_MS = 1000 * 60 * 60 * 24 * 90;

export class LicenseMatcher {

  private similarityScorer = new SimilarityScorer();

  public constructor(private threshold: number, private providerDomains: ReadonlySet<string>) { }

  public isSimilarEnough(license1: License, license2: License): boolean {
    // Skip if over 90 days apart
    if (
      license2.momentStarted - license1.momentEnded > NINETY_DAYS_AS_MS ||
      license1.momentStarted - license2.momentEnded > NINETY_DAYS_AS_MS
    ) {
      return false;
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
      return true;
    }

    let score = 0;
    let opportunity = 80 + 80 + 30 + 30 + 30 + 30;

    opportunity -= 80;
    const addressScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.address1?.toLowerCase(),
      license2.data.technicalContact.address1?.toLowerCase(),
    ));
    if (addressScore) {
      score += addressScore;
    }
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;

    opportunity -= 80;
    const companyScore = Math.round(80 * this.similarityScorer.score(0.90,
      license1.data.company?.toLowerCase(),
      license2.data.company?.toLowerCase(),
    ));
    if (companyScore) {
      score += companyScore;
    }
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;

    const [emailAddress1, domain1] = techContact1.data.email.split('@');
    const [emailAddress2, domain2] = techContact2.data.email.split('@');

    opportunity -= 30;
    if (!this.providerDomains.has(domain1)) {
      const domainScore = Math.round(30 * this.similarityScorer.score(0.80,
        domain1.toLowerCase(),
        domain2.toLowerCase(),
      ));
      score += domainScore;
    }
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;

    opportunity -= 30;
    const emailAddressScore = Math.round(30 * this.similarityScorer.score(0.80,
      emailAddress1.toLowerCase(),
      emailAddress2.toLowerCase(),
    ));
    if (emailAddressScore) {
      score += emailAddressScore;
    }
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;

    opportunity -= 30;
    const techContactNameScore = Math.round(30 * this.similarityScorer.score(0.70,
      license1.data.technicalContact.name?.toLowerCase(),
      license2.data.technicalContact.name?.toLowerCase(),
    ));
    if (techContactNameScore) {
      score += techContactNameScore;
    }
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;

    opportunity -= 30;
    const techContactPhoneScore = Math.round(30 * this.similarityScorer.score(0.90,
      license1.data.technicalContact.phone?.toLowerCase(),
      license2.data.technicalContact.phone?.toLowerCase(),
    ));
    if (techContactPhoneScore) {
      score += techContactPhoneScore;
    }

    return score >= this.threshold;
  }

}
