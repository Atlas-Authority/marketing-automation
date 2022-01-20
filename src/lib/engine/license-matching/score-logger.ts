import { CsvStream } from '../../data/csv-stream';
import DataDir from '../../data/datadir';
import { License } from '../../model/license';
import { shorterLicenseInfo } from './license-grouper';

export class LicenseMatchLogger {

  #scoreStream;
  constructor(private logDir: DataDir, stream: CsvStream) {
    this.#scoreStream = stream;
  }

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
      this.#scoreStream.writeObjectRow({ score, reason, ...shorterLicenseInfo(this.l1) });
      this.#scoreStream.writeObjectRow({ score, reason, ...shorterLicenseInfo(this.l2) });
      this.#scoreStream.writeBlankRow();
    }
  }

  logScore(score: number, reason: string) {
    this.score += score;
    this.scores.push([score, reason]);
  }

  logMatchResults(matches: License[][]) {
    const groups = matches.map(group => group.map(shorterLicenseInfo));

    this.logDir.file('matched-groups-all.csv').writeCsvStream(allMatchGroupsLog => {
      this.logDir.file('matched-groups-to-check.csv').writeCsvStream(checkMatchGroupsLog => {
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
}
