import { updatedDiff } from 'deep-object-diff';
import { Contact, GeneratedContact } from '../types/contact.js';
import { Uploader } from '../uploader/uploader.js';

export async function upsertContactsInHubspot({ uploader, newContacts, oldContacts }: {
  uploader: Uploader,
  newContacts: GeneratedContact[],
  oldContacts: Contact[],
}): Promise<Contact[]> {
  const contactsToCreate: Array<{ properties: GeneratedContact }> = [];

  const contactsToUpdate: Array<{ id: string, properties: Partial<GeneratedContact> }> = [];

  const existingContacts: Contact[] = [];

  for (const newContact of newContacts) {
    let oldContact = oldContacts.find(c => c.email === newContact.email);

    if (oldContact) {
      const { company_id, otherEmails, ...normalizedOldContact } = oldContact;

      const delta: Partial<GeneratedContact> = updatedDiff(normalizedOldContact, newContact);

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
