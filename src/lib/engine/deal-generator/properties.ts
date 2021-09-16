export function dealCreationPropertiesFromLicense(record: License, dealstage: string): Deal['properties'] {
  throw new Error('Function not implemented.');
}

export function dealCreationPropertiesFromTransaction(record: Transaction, dealstage: string): Deal['properties'] {
  throw new Error('Function not implemented.');
}

export function dealUpdatePropertiesForLicense(deal: Deal, record: License): Partial<Deal['properties']> {
  throw new Error('Function not implemented.');
}

export function dealUpdatePropertiesForTransaction(deal: Deal, record: Transaction): Partial<Deal['properties']> {
  throw new Error('Function not implemented.');
}
