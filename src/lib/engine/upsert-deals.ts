import { Uploader } from "../io/uploader/uploader.js";
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from "../types/deal.js";

export async function upsertDealsInHubspot({ uploader, dealDiffs }: {
  uploader: Uploader,
  dealDiffs: {
    dealsToCreate: Omit<Deal, "id">[],
    dealsToUpdate: DealUpdate[],
    associationsToCreate: DealAssociationPair[],
    associationsToRemove: DealAssociationPair[],
    companyAssociationsToCreate: DealCompanyAssociationPair[],
    companyAssociationsToRemove: DealCompanyAssociationPair[],
  },
}) {
  await uploader.updateAllDeals(dealDiffs.dealsToUpdate);
  const createdDeals = await uploader.createAllDeals(dealDiffs.dealsToCreate);

  const newContactAssociations: DealAssociationPair[] = createdDeals.flatMap(d =>
    d.contactIds.map(id => ({ dealId: d.id, contactId: id }))
  );

  await uploader.associateDealsWithContacts([...newContactAssociations, ...dealDiffs.associationsToCreate]);
  await uploader.disassociateDealsFromContacts(dealDiffs.associationsToRemove);

  const newCompanyAssociations: DealCompanyAssociationPair[] = createdDeals.flatMap(d =>
    d.companyIds.map(id => ({ dealId: d.id, companyId: id }))
  );

  await uploader.associateDealsWithCompanies([...newCompanyAssociations, ...dealDiffs.companyAssociationsToCreate]);
  await uploader.disassociateDealsFromCompanies(dealDiffs.companyAssociationsToRemove);
}
