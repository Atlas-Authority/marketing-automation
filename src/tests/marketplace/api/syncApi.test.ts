import { Progress } from '../../../lib/log/download';
import { MpacCreds, dataInsightDateRanges } from '../../../lib/marketplace/api/api';
import nock from 'nock';
import { SyncMarketplaceAPI } from '../../../lib/marketplace/api/syncApi';

const credentials: MpacCreds = {
  user: 'user',
  apiKey: 'apiKey',
  sellerId: '1234',
};

describe('SyncMarketplaceAPI', () => {
  it('should use the correct marketplace APIs when downloadTransactions', async () => {
    const scope = nock(`https://marketplace.atlassian.com`)
      .get(`/rest/2/vendors/${credentials.sellerId}/reporting/sales/transactions/export`)
      .reply(200, []);

    const marketplaceAPI = new SyncMarketplaceAPI(credentials);
    await marketplaceAPI.downloadTransactions();
    scope.done();
  });

  it('should use the correct marketplace APIs when downloadLicensesWithoutDataInsights', async () => {
    const scope = nock(`https://marketplace.atlassian.com`)
      .get(`/rest/2/vendors/${credentials.sellerId}/reporting/licenses/export?endDate=2018-07-01`)
      .reply(200, []);

    const marketplaceAPI = new SyncMarketplaceAPI(credentials);
    await marketplaceAPI.downloadLicensesWithoutDataInsights();
    scope.done();
  });

  it('should use the correct marketplace APIs when downloadLicensesWithDataInsights', async () => {
    const progressMock: Progress = { tick: () => {}, setCount: () => {} };
    const dateInterval = dataInsightDateRanges();

    const scope = nock(`https://marketplace.atlassian.com`)
      .get(`/rest/2/vendors/${credentials.sellerId}/reporting/licenses/export`)
      .query((actualQueryParams) => {
        return (
          actualQueryParams.withDataInsights === 'true' &&
          actualQueryParams.startDate !== '' &&
          actualQueryParams.endDate !== ''
        );
      })
      .times(dateInterval.length)
      .reply(200, []);
    const marketplaceAPI = new SyncMarketplaceAPI(credentials);
    await marketplaceAPI.downloadLicensesWithDataInsights(progressMock);
    scope.done();
  });
});
