import { CsvStream } from '../../cache/csv-stream';
import DataDir, { LogWriteStream } from '../../cache/datadir';
import { License } from '../../model/license';
import { shorterLicenseInfo } from './license-grouper';

export class LicenseMatchLogger {

  #scoreStream;
  constructor(private logDir: DataDir, stream: LogWriteStream) {
    this.#scoreStream = new CsvStream(stream);
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
      this.#scoreStream.writeRow({ score, reason, ...shorterLicenseInfo(this.l1) });
      this.#scoreStream.writeRow({ score, reason, ...shorterLicenseInfo(this.l2) });
      this.#scoreStream.writeBlankRow();
    }
  }

  logScore(score: number, reason: string) {
    this.score += score;
    this.scores.push([score, reason]);
  }

  logMatchResults(matches: License[][]) {
    const groups = matches.map(group => group.map(shorterLicenseInfo));

    this.logDir.file('matched-groups-all.csv').writeStream(allStream => {
      const allMatchGroupsLog = new CsvStream(allStream);

      this.logDir.file('matched-groups-to-check.csv').writeStream(checkStream => {
        const checkMatchGroupsLog = new CsvStream(checkStream);

        for (const match of groups) {
          for (const shortLicense of match) {
            allMatchGroupsLog.writeRow(shortLicense);
          }
          allMatchGroupsLog.writeBlankRow();

          if (match.length > 1 && (
            !match.every(item => item.tech_email === match[0].tech_email) ||
            !match.every(item => item.company === match[0].company) ||
            !match.every(item => item.tech_address === match[0].tech_address)
          )) {
            for (const shortLicense of match) {
              checkMatchGroupsLog.writeRow(shortLicense);
            }
            checkMatchGroupsLog.writeBlankRow();
          }
        }
      });
    });
  }
}
