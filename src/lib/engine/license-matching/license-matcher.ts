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

    // If same exact email, definitely a match
    if (
      (license1.techContact === license2.techContact) ||
      (
        license1.techContact === license2.billingContact ||
        license2.techContact === license1.billingContact
      ) ||
      (
        license1.billingContact &&
        license1.billingContact === license2.billingContact)
    ) {
      return true;
    }

    let score = 0;
    let opportunity = 80 + 80 + 30 + 30 + 30 + 30;

    let s: number; // score
    let t: number; // atLeast
    let a: string | undefined;
    let b: string | undefined;

    s = 80;
    t = 0.90;
    a = license1.data.technicalContact.address1?.toLowerCase();
    b = license2.data.technicalContact.address1?.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    s = 80;
    t = 0.90;
    a = license1.data.company?.toLowerCase();
    b = license2.data.company?.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    const [emailAddress1, domain1] = license1.techContact.data.email.split('@');
    const [emailAddress2, domain2] = license2.techContact.data.email.split('@');

    s = 30;
    t = 0.80;
    a = this.providerDomains.has(domain1) ? '' : domain1.toLowerCase();
    b = this.providerDomains.has(domain2) ? '' : domain2.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    s = 30;
    t = 0.80;
    a = emailAddress1.toLowerCase();
    b = emailAddress2.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    s = 30;
    t = 0.70;
    a = license1.data.technicalContact.name?.toLowerCase();
    b = license2.data.technicalContact.name?.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    s = 30;
    t = 0.90;
    a = license1.data.technicalContact.phone?.toLowerCase();
    b = license2.data.technicalContact.phone?.toLowerCase();
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (score >= this.threshold) return true;
    if (score + (opportunity -= s) < this.threshold) return false;

    return false;
  }

}
