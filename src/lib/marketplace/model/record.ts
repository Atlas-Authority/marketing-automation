import { Contact } from "../../hubspot/model/contact";

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
