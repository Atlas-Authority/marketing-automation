import { mpacConfigFromENV } from "../config/env";
import { Data } from "../data/set";
import { ConsoleLogger } from "../log/console";
import * as validation from "../marketplace/validation";
import { License } from "../model/license";
import { getEmailsForRecord } from "../model/record";
import { Transaction } from "../model/transaction";
import { buildAndVerifyStructures } from "./structure";

export interface MpacConfig {
  ignoredEmails?: Set<string>;
}

export class Marketplace {

  public licenses: License[] = [];
  public transactions: Transaction[] = [];

  public static fromENV() {
    return new Marketplace(mpacConfigFromENV());
  }

  public constructor(private config?: MpacConfig) { }

  public importData(data: Data, console?: ConsoleLogger) {
    console?.printInfo('Database', 'Validating MPAC records: Starting...');

    const emailRe = new RegExp(`.+@.+\\.(${data.tlds.join('|')})`);
    const emailChecker = (kind: 'License' | 'Transaction') =>
      (record: License | Transaction) => {
        const allEmails = getEmailsForRecord(record);
        const allGood = allEmails.every(e => emailRe.test(e));
        if (!allGood && !allEmails.every(e => this.config?.ignoredEmails?.has(e.toLowerCase()))) {
          console?.printWarning('Downloader', `${kind} has invalid email(s); will be skipped:`, record);
        }
        return allGood;
      };

    const combinedLicenses = [
      ...data.licensesWithDataInsights,
      ...data.licensesWithoutDataInsights,
    ];

    let licenses = combinedLicenses.map(raw => License.fromRaw(raw));
    let transactions = data.transactions.map(raw => Transaction.fromRaw(raw));

    licenses = licenses.filter(l => validation.hasTechEmail(l, console));
    licenses = validation.removeApiBorderDuplicates(licenses);

    licenses.forEach(validation.assertRequiredLicenseFields);
    transactions.forEach(validation.assertRequiredTransactionFields);

    licenses = licenses.filter(emailChecker('License'));
    transactions = transactions.filter(emailChecker('Transaction'));

    const structured = buildAndVerifyStructures(licenses, transactions, console);
    this.licenses = structured.licenses;
    this.transactions = structured.transactions;

    console?.printInfo('Database', 'Validating MPAC records: Done');
  }

}
