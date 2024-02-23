import { Progress } from '../../../lib/log/download';
import { MpacCreds, dataInsightDateRanges } from '../../../lib/marketplace/api/api';
import nock from 'nock';
import { AsyncMarketplaceAPI } from '../../../lib/marketplace/api/asyncApi';

const credentials: MpacCreds = {
  user: 'user',
  apiKey: 'apiKey',
  sellerId: '1234',
};
const exportResponseMock = {
  export: {
    id: '123',
  },
  _links: {
    status: { href: '/status' },
    download: { href: '/download' },
  },
};
const statusInProgressResponseMock = {
  export: {
    id: '123',
    status: 'IN_PROGRESS',
  },
};
const statusCompletedResponseMock = {
  export: {
    id: '123',
    status: 'COMPLETED',
  },
};
const licensesOrTransactionsResponseMock = ['license1', 'license2'];

describe('AsyncMarketplaceAPI', () => {
  beforeEach(() => {
    nock('https://marketplace.atlassian.com').get('/status').reply(200, statusInProgressResponseMock);
    nock('https://marketplace.atlassian.com').get('/status').reply(200, statusCompletedResponseMock);
    nock('https://marketplace.atlassian.com').get('/download').reply(200, licensesOrTransactionsResponseMock);
  });

  it('should use the correct marketplace APIs when downloadTransactions', async () => {
    const scope = nock(`https://marketplace.atlassian.com`)
      .post(`/rest/2/vendors/${credentials.sellerId}/reporting/sales/transactions/async/export`)
      .reply(200, exportResponseMock);

    const marketplaceAPI = new AsyncMarketplaceAPI(credentials, 1);
    const transactions = await marketplaceAPI.downloadTransactions();
    expect(transactions).toEqual(licensesOrTransactionsResponseMock);
    scope.done();
  });

  it('should use the correct marketplace APIs when downloadLicensesWithoutDataInsights', async () => {
    const scope = nock(`https://marketplace.atlassian.com`)
      .post(`/rest/2/vendors/${credentials.sellerId}/reporting/licenses/async/export?endDate=2018-07-01`)
      .reply(200, exportResponseMock);

    const marketplaceAPI = new AsyncMarketplaceAPI(credentials, 1);
    const licenses = await marketplaceAPI.downloadLicensesWithoutDataInsights();
    expect(licenses).toEqual(licensesOrTransactionsResponseMock);
    scope.done();
  });

  it('should use the correct marketplace APIs when downloadLicensesWithDataInsights', async () => {
    const progressMock: Progress = { tick: () => {}, setCount: () => {} };

    const scope = nock(`https://marketplace.atlassian.com`)
      .post(`/rest/2/vendors/${credentials.sellerId}/reporting/licenses/async/export?startDate=2018-07-01`)
      .reply(200, exportResponseMock);
    const marketplaceAPI = new AsyncMarketplaceAPI(credentials, 1);
    const licenses = await marketplaceAPI.downloadLicensesWithDataInsights(progressMock);
    expect(licenses).toEqual(licensesOrTransactionsResponseMock);
    scope.done();
  });
});
