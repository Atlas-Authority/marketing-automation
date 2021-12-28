import { Contact } from "../contact";

export abstract class MpacRecord<T> {

  public abstract id: string;
  public abstract tier: number;

  public techContact!: Contact;
  public billingContact: Contact | null = null;
  public partnerContact: Contact | null = null;
  public allContacts: Contact[] = [];

  public constructor(public data: T) { }

}
