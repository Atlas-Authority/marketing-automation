interface GeneratedContact {
  contact_type: 'Partner' | 'Customer';
  country: string;
  region: string;
  hosting: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  company_id: string | null;

  related_products?: string[];
  license_tier?: number;
  deployment?: 'Cloud' | 'Data Center' | 'Server' | 'Multiple';
  last_mpac_event?: string;
}

interface Contact extends GeneratedContact {
  otherEmails: string[];
  hs_object_id: string;
}

interface ContactUpdateAction {
  contact: Contact;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple' | null;
  related_products: string[];
  tier: number;
  event: string;
}

type ContactsByEmail = {
  [email: string]: Contact;
};
