import { Console } from "../log/console";
import { Table } from "../log/table";
import { License } from "../model/license";
import { Transaction, TransactionData } from "../model/transaction";
import { formatMoney } from "../util/formatters";
import { isPresent } from "../util/helpers";

export function buildAndVerifyStructures(licenses: License[], transactions: Transaction[], console?: Console) {
  return new Structurer(console).buildAndVerify(licenses, transactions);
}

class Structurer {

  constructor(private console?: Console) { }

  buildAndVerify(licenses: License[], transactions: Transaction[]) {
    // All three should be unique on licenses
    this.verifyIdIsUnique(licenses, l => l.data.addonLicenseId);
    this.verifyIdIsUnique(licenses, l => l.data.appEntitlementId);
    this.verifyIdIsUnique(licenses, l => l.data.appEntitlementNumber);

    const licensesByAddonLicenseId = new Map<string, License>();
    const licensesByAppEntitlementId = new Map<string, License>();
    const licensesByAppEntitlementNumber = new Map<string, License>();

    // Map all licenses first
    for (const license of licenses) {

      // All license IDs (when present) should point to the same transactions as each other
      const id1 = license.data.appEntitlementId;
      const id2 = license.data.appEntitlementNumber;
      const id3 = license.data.addonLicenseId;

      const array1 = !id1 ? null : transactions.filter(t => id1 === t.data.appEntitlementId);
      const array2 = !id2 ? null : transactions.filter(t => id2 === t.data.appEntitlementNumber);
      const array3 = !id3 ? null : transactions.filter(t => id3 === t.data.addonLicenseId);

      const set1 = array1 && this.uniqueTransactionSetFrom(array1);
      const set2 = array2 && this.uniqueTransactionSetFrom(array2);
      const set3 = array3 && this.uniqueTransactionSetFrom(array3);

      this.verifySameTransactionSet(set1 || null, set2 || null);
      this.verifySameTransactionSet(set2 || null, set3 || null);

      // Store transactions on license, and vice versa
      license.transactions = (array1 ?? array2 ?? array3)!;
      for (const t of license.transactions) {
        t.license = license;
      }

      // Map licenses by their 3 IDs
      const maybeAdd = (license: License, id: string | null, coll: Map<string, License>) => {
        if (id) coll.set(id, license);
      }

      maybeAdd(license, license.data.addonLicenseId, licensesByAddonLicenseId);
      maybeAdd(license, license.data.appEntitlementId, licensesByAppEntitlementId);
      maybeAdd(license, license.data.appEntitlementNumber, licensesByAppEntitlementNumber);
    }

    // Connect via license's `evaluationLicense` if present
    for (const license of licenses) {
      if (license.data.newEvalData) {
        const evalLicense = licensesByAddonLicenseId.get(license.data.newEvalData.evaluationLicense);
        license.evaluatedFrom = evalLicense;
        evalLicense!.evaluatedTo = license;
      }
    }

    // Connect Licenses and Transactions
    const maybeRefunded = new Set<Transaction>();
    const refunds = new Set<Transaction>();

    for (const transaction of transactions) {

      // All license IDs on each transaction should point to the same license
      // (I'm 99% certain this is the logical inverse of the above,
      //  but adding this quick assertion just in case I'm wrong.
      //  Like, what if an ID is missing on License but not Transaction?
      //  It's a bit confusing right now, and this test is cheap.)
      const id1 = transaction.data.appEntitlementId;
      const id2 = transaction.data.appEntitlementNumber;
      const id3 = transaction.data.addonLicenseId;

      const license1 = id1 ? licensesByAppEntitlementId.get(id1) : undefined;
      const license2 = id2 ? licensesByAppEntitlementNumber.get(id2) : undefined;
      const license3 = id3 ? licensesByAddonLicenseId.get(id3) : undefined;

      this.verifyEqualLicenses(license1, license2);
      this.verifyEqualLicenses(license2, license3);

      // Check for transactions with missing licenses
      if (!transaction.license) {
        if (transaction.data.saleType === 'Refund') {
          refunds.add(transaction);
        }
        else {
          maybeRefunded.add(transaction);
        }
      }
    }

    // Warn when some transactions without matching licenses don't seem to be refunds
    const refundAmount = [...refunds].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);
    const refundedAmount = [...maybeRefunded].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);

    if (-refundAmount !== refundedAmount) {
      this.console?.printWarning('Scoring Engine', "The following transactions have no accompanying licenses:");

      const sameById = (tx1: Transaction, tx2: Transaction, id: keyof TransactionData) => (
        tx1.data[id] && tx1.data[id] === tx2.data[id]
      );

      for (const refund of refunds) {
        const maybeMatch = [...maybeRefunded].find(maybeRefunded =>
          (
            sameById(refund, maybeRefunded, 'addonLicenseId') ||
            sameById(refund, maybeRefunded, 'appEntitlementId') ||
            sameById(refund, maybeRefunded, 'appEntitlementNumber')
          ) && maybeRefunded.data.vendorAmount === -refund.data.vendorAmount
        );
        if (maybeMatch) {
          refunds.delete(refund);
          maybeRefunded.delete(maybeMatch);
        }
      }

      if (refunds.size > 0) {
        Table.print({
          title: 'Refunds',
          log: s => this.console?.printWarning('Scoring Engine', '  ' + s),
          cols: [
            [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
            [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
          ],
          rows: refunds,
        });
      }

      if (maybeRefunded.size > 0) {
        Table.print({
          title: 'Non-Refunds',
          log: s => this.console?.printWarning('Scoring Engine', '  ' + s),
          cols: [
            [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
            [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
          ],
          rows: maybeRefunded,
        });
      }
    }

    return {
      licenses,
      transactions: transactions.filter(t => t.license),
    };
  }


  verifyIdIsUnique(licenses: License[], getter: (r: License) => string | null) {
    const ids = licenses.map(getter).filter(isPresent);
    const idSet = new Set(ids);
    if (ids.length !== idSet.size) {
      const idName = getter.toString().replace(/(\w+) => \1\.data\./, '');
      this.console?.printError('Database', 'License IDs not unique:', idName);
    }
  }

  uniqueTransactionSetFrom(transactions: Transaction[]) {
    const set = new Set(transactions);
    if (set.size !== transactions.length) {
      this.console?.printError('Database', `Transactions aren't unique: got ${set.size} out of ${transactions.length}`);
    }
    return set;
  }

  verifySameTransactionSet(set1: Set<Transaction> | null, set2: Set<Transaction> | null) {
    if (!set1 || !set2) return;

    const same = set1.size === set2.size && [...set1].every(t => set2.has(t));
    if (!same) {
      this.console?.printError('Database', `License IDs do not point to same transactions`);
    }
  }

  verifyEqualLicenses(license1: License | undefined, license2: License | undefined) {
    if (!license1 || !license2) return;

    if (license1 !== license2) {
      this.console?.printError('Database', `License IDs do not point to same License from Transaction`);
    }
  }

}
