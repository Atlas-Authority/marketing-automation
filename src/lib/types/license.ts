import { RawLicense } from "./marketplace.js";
import { Transaction } from "./transaction.js";

export type License = RawLicense;

export type LicenseContext = {
  license: License;
  transactions: Transaction[];
};

/** Related via the matching engine. */
export type RelatedLicenseSet = LicenseContext[];
