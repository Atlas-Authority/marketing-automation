import { updatedDiff } from 'deep-object-diff';

/**
 * @param {object} data
 * @param {Uploader} data.uploader
 * @param {Contact[]} data.oldContacts
 * @param {GeneratedContact[]} data.newContacts
 * @returns {Promise<Contact[]>}
 */
export async function upsertContactsInHubspot({ uploader, newContacts, oldContacts }) {
  /** @type {Array<{ properties: GeneratedContact }>} */
  const contactsToCreate = [];

  /** @type {Array<{ id: string, properties: Partial<GeneratedContact> }>} */
  const contactsToUpdate = [];

  /** @type {Contact[]} */
  const existingContacts = [];

  for (const newContact of newContacts) {
    let oldContact = oldContacts.find(c => c.email === newContact.email);

    if (oldContact) {
      const { company_id, otherEmails, ...normalizedOldContact } = oldContact;

      /** @type {Partial<GeneratedContact>} */
      const delta = updatedDiff(normalizedOldContact, newContact);

      if (Object.keys(delta).length > 0) {
        contactsToUpdate.push({
          id: oldContact.hs_object_id,
          properties: delta,
        });
      }

      existingContacts.push({
        ...oldContact, // for the properties generated later
        hs_object_id: oldContact.hs_object_id,
        ...newContact,
        company_id,
        otherEmails,
      });
    }
    else {
      contactsToCreate.push({ properties: newContact });
    }
  }

  await uploader.updateAllContacts(contactsToUpdate);
  const createdContacts = await uploader.createAllContacts(contactsToCreate);

  return existingContacts.concat(createdContacts);
}
