import DataDir from '../../cache/datadir';
import { License } from '../../model/license';
import { shorterLicenseInfo } from './license-grouper';

export class LicenseMatchLogger {

  #file = DataDir.out.file('license-scoring.csv').writeStream();

  l1!: License;
  l2!: License;
  scores: [number, string][] = [];
  didHeaders = false;

  beginGroup(l1: License, l2: License) {
    this.l1 = l1;
    this.l2 = l2;
    this.scores.length = 0;
  }

  endGroup() {
    let score = 0;
    for (const [s, r] of this.scores) score += s;

    if (score > 0) {
      const reason = this.scores.filter(([s, r]) => s).map(([s, r]) => `${r}=${s}`).join(',');
      const info1 = { score, reason, ...shorterLicenseInfo(this.l1) };
      const info2 = { score, reason, ...shorterLicenseInfo(this.l2) };
      const keys = Object.keys(info1);

      if (this.didHeaders) {
        this.#file.writeLine(','.repeat(keys.length - 1));
      }
      else {
        this.#file.writeLine(keys.join(','));
        this.didHeaders = true;
      }

      this.#file.writeLine(Object.values(info1).map(o => JSON.stringify(o)).join(','));
      this.#file.writeLine(Object.values(info2).map(o => JSON.stringify(o)).join(','));
    }
  }

  logScore(score: number, reason: string) {
    this.scores.push([score, reason]);
  }

  close() {
    this.#file.close();
  }

}
