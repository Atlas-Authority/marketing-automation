import { ConsoleLogger } from "../log/console";
import { Table } from "../log/table";
import { License } from "../model/license";
import { Transaction, TransactionData } from "../model/transaction";
import { formatMoney } from "../util/formatters";

export function buildAndVerifyStructures(licenses: License[], transactions: Transaction[], console?: ConsoleLogger) {
  return new MpacStructurer(console).buildAndVerify(licenses, transactions);
}

class MpacStructurer {

  constructor(private console?: ConsoleLogger) { }

  buildAndVerify(licenses: License[], transactions: Transaction[]) {
    // Build license mappings

    const licensesByAddonLicenseId = new Map<string, License>();
    const licensesByAppEntitlementId = new Map<string, License>();
    const licensesByAppEntitlementNumber = new Map<string, License>();

    const addLicense = (license: License, id: string | null, mapping: Map<string, License>) => {
      if (!id) return;
      const existing = mapping.get(id);
      if (existing) {
        this.console?.printInfo('MPAC Verifier', `Found two licenses for ${id}:`, [existing.data, license.data]);
      }
      mapping.set(id, license);
    }

    for (const license of licenses) {
      addLicense(license, license.data.addonLicenseId, licensesByAddonLicenseId);
      addLicense(license, license.data.appEntitlementId, licensesByAppEntitlementId);
      addLicense(license, license.data.appEntitlementNumber, licensesByAppEntitlementNumber);
    }

    this.console?.printInfo('MPAC Verifier', 'Checking License Multi-ID uniqueness...');
    this.checkIfIdIsUnique(licensesByAddonLicenseId, licensesByAppEntitlementId, licensesByAppEntitlementNumber);
    this.checkIfIdIsUnique(licensesByAppEntitlementId, licensesByAddonLicenseId, licensesByAppEntitlementNumber);
    this.checkIfIdIsUnique(licensesByAppEntitlementNumber, licensesByAddonLicenseId, licensesByAppEntitlementId);
    this.console?.printInfo('MPAC Verifier', 'Done');

    // Build transaction mappings

    const transactionsByAddonLicenseId = new Map<string, Set<Transaction>>();
    const transactionsByAppEntitlementId = new Map<string, Set<Transaction>>();
    const transactionsByAppEntitlementNumber = new Map<string, Set<Transaction>>();

    const addTransaction = (transaction: Transaction, id: string | null, mapping: Map<string, Set<Transaction>>) => {
      if (!id) return;
      let set = mapping.get(id);
      if (!set) mapping.set(id, set = new Set());
      set.add(transaction)
    }

    for (const transaction of transactions) {
      addTransaction(transaction, transaction.data.addonLicenseId, transactionsByAddonLicenseId);
      addTransaction(transaction, transaction.data.appEntitlementId, transactionsByAppEntitlementId);
      addTransaction(transaction, transaction.data.appEntitlementNumber, transactionsByAppEntitlementNumber);
    }

    this.console?.printInfo('MPAC Verifier', 'Checking Transaction Multi-ID uniqueness...');
    this.checkIfIdIsUnique(transactionsByAddonLicenseId, transactionsByAppEntitlementId, transactionsByAppEntitlementNumber);
    this.checkIfIdIsUnique(transactionsByAppEntitlementId, transactionsByAddonLicenseId, transactionsByAppEntitlementNumber);
    this.checkIfIdIsUnique(transactionsByAppEntitlementNumber, transactionsByAddonLicenseId, transactionsByAppEntitlementId);
    this.console?.printInfo('MPAC Verifier', 'Done');

    // Verify id characteristics

    for (const license of licenses) {

      // All present IDs should point to the same license

      const appId = license.data.appEntitlementId;
      const appNumber = license.data.appEntitlementNumber;
      const addonLicId = license.data.addonLicenseId;

      const l1 = appId ? licensesByAppEntitlementId.get(appId) : undefined;
      const l2 = appNumber ? licensesByAppEntitlementNumber.get(appNumber) : undefined;
      const l3 = addonLicId ? licensesByAddonLicenseId.get(addonLicId) : undefined;

      this.verifyEqualLicenses(l1, l2);
      this.verifyEqualLicenses(l2, l3);

      // All present IDs should point to the same transaction set

      const ts1 = appId ? transactionsByAppEntitlementId.get(appId) : undefined;
      const ts2 = appNumber ? transactionsByAppEntitlementNumber.get(appNumber) : undefined;
      const ts3 = addonLicId ? transactionsByAddonLicenseId.get(addonLicId) : undefined;

      this.verifySameTransactionSet(ts1, ts2);
      this.verifySameTransactionSet(ts2, ts3);

      // Now connect them

      const transactions = ts1 ?? ts2 ?? ts3;
      if (transactions) {
        license.transactions = [...transactions];
        for (const t of license.transactions) {
          t.license = license;
        }
      }

      if (license.data.newEvalData) {
        const evalLicense = (
          licensesByAddonLicenseId.get(license.data.newEvalData.evaluationLicense) ??
          licensesByAppEntitlementId.get(license.data.newEvalData.evaluationLicense) ??
          licensesByAppEntitlementNumber.get(license.data.newEvalData.evaluationLicense)
        );

        if (evalLicense) {
          license.evaluatedFrom = evalLicense;
          evalLicense.evaluatedTo = license;
        }
        else {
          this.console?.printWarning('MPAC Verifier', `Cannot find evaluation license`, {
            newEvalData: license.data.newEvalData,
            onLicense: license.id,
          });
        }
      }
    }

    // Check for transactions with missing licenses.
    // They're probably refunds, so we mainly handle that.

    const maybeRefunded = new Set<Transaction>();
    const refunds = new Set<Transaction>();

    for (const transaction of transactions) {
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
      this.console?.printWarning('MPAC Verifier', "The following transactions have no accompanying licenses:");

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
          log: s => this.console?.printWarning('MPAC Verifier', '  ' + s),
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
          log: s => this.console?.printWarning('MPAC Verifier', '  ' + s),
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


  private verifySameTransactionSet(set1: Set<Transaction> | undefined, set2: Set<Transaction> | undefined) {
    if (!set1 || !set2) return;

    const same = set1.size === set2.size && [...set1].every(t => set2.has(t));
    if (!same) {
      this.console?.printError('MPAC Verifier', `License IDs do not point to same transactions`);
    }
  }

  private verifyEqualLicenses(license1: License | undefined, license2: License | undefined) {
    if (!license1 || !license2) return;

    if (license1 !== license2) {
      this.console?.printError('MPAC Verifier', `License IDs do not point to same License from Transaction`);
    }
  }

  private checkIfIdIsUnique(a: Map<string, any>, b: Map<string, any>, c: Map<string, any>) {
    for (const key of a.keys()) {
      if (b.has(key) || c.has(key)) {
        this.console?.printWarning('MPAC Verifier', 'ID is not unique:', key);
      }
    }
  }

}
