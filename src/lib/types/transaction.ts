import { RawTransaction } from "./marketplace.js";

export type Transaction = RawTransaction;

export interface DealNameTemplateProperties {
  addonKey: string,
  addonName: string,
  hosting: 'Server' | 'Cloud' | 'Data Center',
  licenseType: 'EVALUATION' | 'COMMERCIAL' | 'COMMUNITY' | 'ACADEMIC' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  tier: string,
  company: string,
  country: string,
  region: string,
  technicalContactEmail: string,
}
