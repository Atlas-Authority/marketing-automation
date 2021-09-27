import { Contact } from "../types/contact.js";
import { Deal, DealAssociationPair, DealUpdate } from "../types/deal.js";
import { Uploader } from "../io/uploader/uploader.js";

export async function upsertDealsInHubspot({ uploader, dealDiffs, contacts }: {
  uploader: Uploader,
  dealDiffs: {
    dealsToCreate: Omit<Deal, "id">[],
    dealsToUpdate: DealUpdate[],
    associationsToCreate: DealAssociationPair[],
    associationsToRemove: DealAssociationPair[],
  },
  contacts: Contact[],
}) {
  await uploader.updateAllDeals(dealDiffs.dealsToUpdate);
  const createdDeals = await uploader.createAllDeals(dealDiffs.dealsToCreate);

  const newAssociations: DealAssociationPair[] = createdDeals.flatMap(d =>
    d.contactIds.map(id => ({ dealId: d.id, contactId: id }))
  );

  const contactsById: { [id: string]: Contact } = Object.create(null);
  for (const contact of contacts) {
    contactsById[contact.hs_object_id] = contact;
  }

  await uploader.associateDealsWithContacts(sortCustomersBeforePartners(contactsById, newAssociations));
  await uploader.associateDealsWithContacts(sortCustomersBeforePartners(contactsById, dealDiffs.associationsToCreate));
  await uploader.disassociateDealsFromContacts(dealDiffs.associationsToRemove);
}

function sortCustomersBeforePartners(contacts: { [id: string]: Contact }, associations: DealAssociationPair[]) {
  return [
    ...associations.filter(a => contacts[a.contactId].contact_type === 'Customer'),
    ...associations.filter(a => contacts[a.contactId].contact_type === 'Partner'),
  ];
}
