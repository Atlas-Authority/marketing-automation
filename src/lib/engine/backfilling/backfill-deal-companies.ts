import { Database } from '../../model/database.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';

export function backfillDealCompanies(db: Database, allMatches: RelatedLicenseSet[]) {
  for (const deal of db.dealManager.getAll()) {
    const contacts = deal.contacts.getAll();
    const customers = contacts.filter(c => c.isCustomer);
    const customerCompany = customers.flatMap(customer => customer.companies.getAll());
    for (const company of customerCompany) {
      deal.companies.add(company);
    }
  }
}
