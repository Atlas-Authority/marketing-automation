import { verifyDealGeneration } from '../utils';

verifyDealGeneration(
  'License deal create',
  [],
  [
    {
      transactions: [],
      license: {
        addonLicenseId: '10023587',
        licenseId: 'SEN-72924873',
        addonKey: 'ucvok',
        addonName: 'Net',
        company: 'Torchmark Corporation',
        country: 'GN',
        tier: 'Unlimited Users',
        licenseType: 'COMMUNITY',
        hosting: 'Server',
        maintenanceStartDate: '2021-09-22',
        maintenanceEndDate: '2022-09-22',
        status: 'active',
        evaluationOpportunitySize: 'NA',
      }
    }
  ],
  [{
    type: 'purchase',
    licenseIds: ['10023587'],
    transactionIds: [],
  }],
  [{
    type: 'create',
    dealStage: 1,
    addonLicenseId: '10023587',
    transactionId: null,
    closeDate: '2021-09-22',
    deployment: 'Server',
    app: 'ucvok',
    licenseTier: 10001,
    country: 'GN',
    dealName: 'Net at Torchmark Corporation',
    pipeline: 0,
    amount: 0
  }],
);

verifyDealGeneration(
  'License deal noop',
  [
    {
      dealstage: '1234569   # Hubspot DealStage ID',
      addonlicenseid: '10023587',
      transactionid: '',
      closedate: '2021-09-22',
      deployment: 'Server',
      aa_app: 'ucvok',
      license_tier: '10001',
      country: 'GN',
      origin: 'MPAC Lead                  # Optional',
      related_products: 'Marketplace Apps # Optional',
      dealname: 'Net at Torchmark Corporation',
      pipeline: '1234567          # Hubspot Pipeline ID',
      amount: '0'
    }
  ],
  [
    {
      transactions: [],
      license: {
        addonLicenseId: '10023587',
        licenseId: 'SEN-72924873',
        addonKey: 'ucvok',
        addonName: 'Net',
        company: 'Torchmark Corporation',
        country: 'GN',
        tier: 'Unlimited Users',
        licenseType: 'COMMUNITY',
        hosting: 'Server',
        maintenanceStartDate: '2021-09-22',
        maintenanceEndDate: '2022-09-22',
        status: 'active',
        evaluationOpportunitySize: 'NA',
      }
    }
  ],
  [{
    type: 'purchase',
    licenseIds: ['10023587'],
    transactionIds: [],
  }],
  [{
    type: 'create',
    dealStage: 1,
    addonLicenseId: '10023587',
    transactionId: null,
    closeDate: '2021-09-22',
    deployment: 'Server',
    app: 'ucvok',
    licenseTier: 10001,
    country: 'GN',
    dealName: 'Net at Torchmark Corporation',
    pipeline: 0,
    amount: 0
  }],
);

verifyDealGeneration(
  'License deal update',
  [
    {
      dealstage: '1234569   # Hubspot DealStage ID',
      addonlicenseid: '10023587',
      transactionid: '',
      closedate: '2021-09-22',
      deployment: 'Server',
      aa_app: 'ucvok',
      license_tier: '10001',
      country: 'GN',
      origin: 'MPAC Lead                  # Optional',
      related_products: 'Marketplace Apps # Optional',
      dealname: 'Net at Torchmark Corporation',
      pipeline: '1234567          # Hubspot Pipeline ID',
      amount: '0'
    }
  ],
  [
    {
      transactions: [],
      license: {
        addonLicenseId: '10023587',
        licenseId: 'SEN-72924873',
        addonKey: 'ucvok',
        addonName: 'Net',
        company: 'Torchmark Corporation',
        country: 'GN',
        tier: 'Unlimited Users',
        licenseType: 'COMMUNITY',
        hosting: 'Server',
        maintenanceStartDate: '2021-09-23',
        maintenanceEndDate: '2022-09-23',
        status: 'active',
        evaluationOpportunitySize: 'NA',
      }
    }
  ],
  [{
    type: 'purchase',
    licenseIds: ['10023587'],
    transactionIds: [],
  }],
  [{
    type: 'create',
    dealStage: 1,
    addonLicenseId: '10023587',
    transactionId: null,
    closeDate: '2021-09-23',
    deployment: 'Server',
    app: 'ucvok',
    licenseTier: 10001,
    country: 'GN',
    dealName: 'Net at Torchmark Corporation',
    pipeline: 0,
    amount: 0
  }],
);

verifyDealGeneration(
  'Create deal with transaction',
  [],
  [
    {
      transactions: [{
        addonLicenseId: '68407053',
        licenseId: 'SEN-91550153',
        hosting: 'Server',
        maintenanceStartDate: "2021-05-06",
        maintenanceEndDate: "2022-05-06",
        licenseType: 'COMMERCIAL',
        saleType: 'New',
        saleDate: '2021-05-06',
        transactionId: 'AT-177995905',
        vendorAmount: 918,
        company: 'Torchmark Corporation',
        country: 'DG',
        addonKey: "ucvok",
        addonName: "Net",
        tier: 'Unlimited Users'
      }],
      license: {
        addonLicenseId: '68407053',
        licenseId: 'SEN-91550153',
        addonKey: 'ucvok',
        addonName: 'Net',
        company: 'Torchmark Corporation',
        country: 'DG',
        tier: 'Unlimited Users',
        licenseType: 'COMMERCIAL',
        hosting: 'Server',
        maintenanceStartDate: '2021-05-06',
        maintenanceEndDate: '2021-05-06',
        status: 'active',
        evaluationOpportunitySize: 'NA',
      }
    }
  ],
  [{
    type: 'purchase',
    licenseIds: ['68407053'],
    transactionIds: ['AT-177995905[68407053]'],
  }],
  [{
    type: 'create',
    dealStage: 1,
    addonLicenseId: '68407053',
    transactionId: 'AT-177995905',
    closeDate: '2021-05-06',
    deployment: 'Server',
    app: 'ucvok',
    licenseTier: 10001,
    country: 'DG',
    dealName: 'Net at Torchmark Corporation',
    pipeline: 0,
    amount: 918,
  }],
);
