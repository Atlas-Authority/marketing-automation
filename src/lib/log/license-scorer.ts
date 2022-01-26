import { CsvStream } from '../data/csv';
import { shorterLicenseInfo } from '../license-matching/license-grouper';
import { License } from '../model/license';

export class LicenseMatchLogger {

  constructor(private stream: CsvStream) { }

  l1!: License;
  l2!: License;
  scores: [number, string][] = [];
  score!: number;
  didHeaders = false;

  beginGroup(l1: License, l2: License) {
    this.l1 = l1;
    this.l2 = l2;
    this.scores.length = 0;
    this.score = 0;
  }

  endGroup() {
    const score = this.score;
    if (score > 0) {
      const reason = this.scores.filter(([s, r]) => s).map(([s, r]) => `${r}=${s}`).join(',');
      this.stream.writeObjectRow({ score, reason, ...shorterLicenseInfo(this.l1) });
      this.stream.writeObjectRow({ score, reason, ...shorterLicenseInfo(this.l2) });
      this.stream.writeBlankRow();
    }
  }

  logScore(score: number, reason: string) {
    this.score += score;
    this.scores.push([score, reason]);
  }

  close() {
    this.stream.close();
  }

}
