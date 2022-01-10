import { Contact } from "../../model/contact";
import { License } from "../../model/license";
import { SimilarityScorer } from "./similarity-scorer";

const NINETY_DAYS_AS_MS = 1000 * 60 * 60 * 24 * 90;

export interface ScorableLicense {
  license: License;

  momentStarted: number;
  momentEnded: number;

  techContact: Contact;
  billingContact: Contact | null;

  company: string | undefined;
  companyDomain: string;

  techContactEmailPart: string;
  techContactAddress: string | undefined;
  techContactPhone: string | undefined;
  techContactName: string | undefined;
}

export class LicenseMatcher {

  private similarityScorer = new SimilarityScorer();

  public constructor(private threshold: number) { }

  public isSimilarEnough(license1: ScorableLicense, license2: ScorableLicense): boolean {
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
    let bail;

    let s: number; // score
    let t: number; // atLeast
    let a: string | undefined;
    let b: string | undefined;

    s = 80;
    t = 0.90;
    a = license1.techContactAddress;
    b = license2.techContactAddress;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 80;
    t = 0.90;
    a = license1.company;
    b = license2.company;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.80;
    a = license1.companyDomain;
    b = license2.companyDomain;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.80;
    a = license1.techContactEmailPart;
    b = license2.techContactEmailPart;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.70;
    a = license1.techContactName;
    b = license2.techContactName;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.90;
    a = license1.techContactPhone;
    b = license2.techContactPhone;
    score += Math.round(s * this.similarityScorer.score(t, a, b));
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    return false;
  }

  bail(score: number, opportunity: number): any {
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;
  }

}
