import { Contact } from "../model/contact";
import { scoreSimilarity } from "./similarity-scorer";

const NINETY_DAYS_AS_MS = 1000 * 60 * 60 * 24 * 90;

export interface ScorableLicense {
  momentStarted: number;
  momentEnded: number;

  techContact: Contact;
  billingContact: Contact | null;

  company: string;
  companyDomain: string;

  techContactEmailPart: string;
  techContactAddress: string;
  techContactPhone: string;
  techContactName: string;
}

interface ScoreLog {
  logScore(score: number, reason: string): void;
}

export class LicenseMatcher {

  public constructor(private threshold: number, private scoreLog?: ScoreLog) { }

  public isSimilarEnough(
    l1: ScorableLicense,
    l2: ScorableLicense,
  ): boolean {
    // Skip if over 90 days apart
    if (
      l2.momentStarted - l1.momentEnded > NINETY_DAYS_AS_MS ||
      l1.momentStarted - l2.momentEnded > NINETY_DAYS_AS_MS
    ) {
      return false;
    }

    if (l1.techContact === l2.techContact) {
      this.scoreLog?.logScore(1000, 'Same tech contacts');
      return true;
    }

    if (l1.billingContact && l1.billingContact === l2.billingContact) {
      this.scoreLog?.logScore(1000, 'Same billing contacts');
      return true;
    }

    if (l1.techContact === l2.billingContact || l2.techContact === l1.billingContact) {
      this.scoreLog?.logScore(1000, 'Same tech/billing contacts');
      return true;
    }

    let score = 0;
    let opportunity = 80 + 80 + 30 + 30 + 30 + 30;
    let bail: boolean | void;

    let p: number; // possible score
    let s: number; // actual score
    let t: number; // atLeast
    let a: string | undefined;
    let b: string | undefined;

    p = 80;
    t = 0.90;
    a = l1.techContactAddress;
    b = l2.techContactAddress;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Tech Contact Address');
    if (undefined !== (bail = this.bail(score, opportunity -= p))) return bail;

    p = 80;
    t = 0.90;
    a = l1.company;
    b = l2.company;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Company Name');
    if (undefined !== (bail = this.bail(score, opportunity -= p))) return bail;

    p = 30;
    t = 0.80;
    a = l1.companyDomain;
    b = l2.companyDomain;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Company Domain');
    if (undefined !== (bail = this.bail(score, opportunity -= p))) return bail;

    p = 30;
    t = 0.80;
    a = l1.techContactEmailPart;
    b = l2.techContactEmailPart;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Tech Email Address (first part)');
    if (undefined !== (bail = this.bail(score, opportunity -= p))) return bail;

    p = 30;
    t = 0.70;
    a = l1.techContactName;
    b = l2.techContactName;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Tech Contact Name');
    if (undefined !== (bail = this.bail(score, opportunity -= p))) return bail;

    p = 30;
    t = 0.90;
    a = l1.techContactPhone;
    b = l2.techContactPhone;
    score += (s = Math.round(p * scoreSimilarity(t, a, b)));
    this.scoreLog?.logScore(s, 'Tech Contact Phone');

    return score >= this.threshold;
  }

  bail(score: number, opportunity: number): boolean | void {
    if (!this.scoreLog) {
      if (score >= this.threshold) return true;
      if (score + opportunity < this.threshold) return false;
    }
  }

}
