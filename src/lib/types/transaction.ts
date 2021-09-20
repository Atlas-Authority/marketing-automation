export interface Transaction {
  transactionId: string,
  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,
  customerDetails: {
    company: string,
    country: string,
    region: string,
    technicalContact: {
      email: string,
      name?: string
    },
    billingContact?: {
      email: string,
      name?: string
    }
  },
  purchaseDetails: {
    saleDate: string,
    tier: string,
    licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY',
    hosting: 'Cloud' | 'Server' | 'Data Center',
    billingPeriod: string,
    purchasePrice: number,
    vendorAmount: number,
    saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund',
    maintenanceStartDate: string,
    maintenanceEndDate: string,
  },
  partnerDetails?: {
    partnerName: string,
    partnerType?: string,
    billingContact: {
      email: string,
      name: string,
    },
  },
}
