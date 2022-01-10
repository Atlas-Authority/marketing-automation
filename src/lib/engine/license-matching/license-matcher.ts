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

interface ScoreLog {
  log(license1: ScorableLicense, license2: ScorableLicense, score: number, reason: string): void;
}

export class LicenseMatcher {

  private similarityScorer = new SimilarityScorer();

  public constructor(private threshold: number, private scoreLog?: ScoreLog) { }

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
    score += this.score(license1, license2, 'Tech Contact Address', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 80;
    t = 0.90;
    a = license1.company;
    b = license2.company;
    score += this.score(license1, license2, 'Company Name', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.80;
    a = license1.companyDomain;
    b = license2.companyDomain;
    score += this.score(license1, license2, 'Company Domain', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.80;
    a = license1.techContactEmailPart;
    b = license2.techContactEmailPart;
    score += this.score(license1, license2, 'Tech Email Address (first part)', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.70;
    a = license1.techContactName;
    b = license2.techContactName;
    score += this.score(license1, license2, 'Tech Contact Name', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    s = 30;
    t = 0.90;
    a = license1.techContactPhone;
    b = license2.techContactPhone;
    score += this.score(license1, license2, 'Tech Contact Phone', t, a, b, s);
    if (undefined !== (bail = this.bail(score, opportunity -= s))) return bail;

    return false;
  }

  score(l1: ScorableLicense, l2: ScorableLicense, reason: string, t: number, a: string | undefined, b: string | undefined, s: number) {
    const score = Math.round(s * this.similarityScorer.score(t, a, b));
    this.scoreLog?.log(l1, l2, score, reason);
    return score;
  }

  bail(score: number, opportunity: number): any {
    if (score >= this.threshold) return true;
    if (score + opportunity < this.threshold) return false;
  }

}
