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

export type PartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingEmail: string;
  billingName: string;
};
