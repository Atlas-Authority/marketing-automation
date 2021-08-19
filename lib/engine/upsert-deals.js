/**
 * @param {object}                data
 * @param {Uploader}              data.uploader
 * @param {object}                data.dealDiffs
 * @param {Omit<Deal, "id">[]}    data.dealDiffs.dealsToCreate
 * @param {DealUpdate[]}          data.dealDiffs.dealsToUpdate
 * @param {DealAssociationPair[]} data.dealDiffs.associationsToCreate
 * @param {DealAssociationPair[]} data.dealDiffs.associationsToRemove
 * @param {Contact[]}             data.contacts
 */
export async function upsertDealsInHubspot({ uploader, dealDiffs, contacts }) {
  await uploader.updateAllDeals(dealDiffs.dealsToUpdate);
  const createdDeals = await uploader.createAllDeals(dealDiffs.dealsToCreate);

  /** @type {DealAssociationPair[]} */
  const newAssociations = createdDeals.flatMap(d =>
    d.contactIds.map(id => ({ dealId: d.id, contactId: id }))
  );

  /** @type {{ [id: string]: Contact }} */
  const contactsById = Object.create(null);
  for (const contact of contacts) {
    contactsById[contact.hs_object_id] = contact;
  }

  await uploader.associateDealsWithContacts(sortCustomersBeforePartners(contactsById, newAssociations));
  await uploader.associateDealsWithContacts(sortCustomersBeforePartners(contactsById, dealDiffs.associationsToCreate));
  await uploader.disassociateDealsFromContacts(dealDiffs.associationsToRemove);
}

/**
 * @param {{ [id: string]: Contact }} contacts
 * @param {DealAssociationPair[]} associations
 */
function sortCustomersBeforePartners(contacts, associations) {
  return [
    ...associations.filter(a => contacts[a.contactId].contact_type === 'Customer'),
    ...associations.filter(a => contacts[a.contactId].contact_type === 'Partner'),
  ];
}
