/**
 * @param {object}                data
 * @param {Uploader}              data.uploader
 * @param {object}                data.dealDiffs
 * @param {Omit<Deal, "id">[]}    data.dealDiffs.dealsToCreate
 * @param {DealUpdate[]}          data.dealDiffs.dealsToUpdate
 * @param {DealAssociationPair[]} data.dealDiffs.associationsToCreate
 * @param {DealAssociationPair[]} data.dealDiffs.associationsToRemove
 */
export async function upsertDealsInHubspot({ uploader, dealDiffs }) {
  await uploader.updateAllDeals(dealDiffs.dealsToUpdate);
  const createdDeals = await uploader.createAllDeals(dealDiffs.dealsToCreate);

  /** @type {DealAssociationPair[]} */
  const newAssociations = createdDeals.flatMap(d =>
    d.contactIds.map(id => ({ dealId: d.id, contactId: id }))
  );

  await uploader.associateDealsWithContacts(newAssociations);
  await uploader.associateDealsWithContacts(dealDiffs.associationsToCreate);
  await uploader.disassociateDealsFromContacts(dealDiffs.associationsToRemove);
}
