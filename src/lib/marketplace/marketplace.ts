import { RawDataSet } from "../data/raw";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";
import { getEmailsForRecord } from "../model/record";
import { Transaction } from "../model/transaction";
import { buildAndVerifyStructures } from "./structure";
import * as validation from "./validation";

export interface MpacConfig {
  ignoredEmails?: Set<string>;
}

export class Marketplace {

  public licenses: License[] = [];
  public transactions: Transaction[] = [];

  public constructor(private config?: MpacConfig) { }

  public importData(data: RawDataSet, console?: ConsoleLogger) {
    console?.printInfo('MPAC', 'Validating MPAC records: Starting...');
    console?.printInfo("MPAC", 'ignored emails', this.config?.ignoredEmails)

    const emailRe = new RegExp(`.+@.+\\.(${data.tlds.join('|')})`);
    const emailChecker = (kind: 'License' | 'Transaction') =>
      (record: License | Transaction) => {
        const allEmails = getEmailsForRecord(record);
        const allGood = allEmails.every(e => emailRe.test(e));
        const isIgnored = allEmails.some(e => this.config?.ignoredEmails?.has(e.toLowerCase()));
        if (!allGood || isIgnored) {
          console?.printWarning('MPAC', `${kind} has invalid email(s); will be skipped:`, record);
        }
        return allGood && !isIgnored;
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

    console?.printInfo('MPAC', 'Validating MPAC records: Done');
  }

}
