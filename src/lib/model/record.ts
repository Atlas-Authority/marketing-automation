import { isPresent } from "../util/helpers";
import { Contact } from "./contact";
import { License } from "./license";
import { Transaction } from "./transaction";

export abstract class MpacRecord<T> {

  public abstract id: string;
  public abstract tier: number;

  public techContact!: Contact;
  public billingContact: Contact | null = null;
  public partnerContact: Contact | null = null;
  public allContacts: Contact[] = [];

  public partnerDomain: string | null = null;

  public constructor(public data: T) { }

}

export type ContactInfo = {
  email: string,
  name?: string,
  phone?: string,
  address1?: string,
  address2?: string,
  city?: string,
  state?: string,
  postcode?: string,
};

export type PartnerBillingInfo = {
  email: string;
  name: string;
};

export type PartnerInfo = {
  billingContact: PartnerBillingInfo;
  partnerName: string;
  partnerType?: string;
};

export function getEmailsForRecord(record: License | Transaction) {
  return [
    record.data.technicalContact?.email,
    record.data.billingContact?.email,
    record.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}
