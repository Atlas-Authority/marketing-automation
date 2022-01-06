
export interface MpacCreds {
  user: string,
  apiKey: string,
  sellerId: string,
}

export type HubspotCreds = {
  accessToken: string,
} | {
  apiKey: string,
};
