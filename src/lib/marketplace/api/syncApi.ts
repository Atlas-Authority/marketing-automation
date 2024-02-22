import got from 'got';
import { Progress } from '../../log/download';
import { KnownError, AttachableError } from '../../util/errors';
import { RawTransaction, RawLicense } from '../raw';
import { MpacCreds, dataInsightDateRanges } from './api';

export class SyncMarketplaceAPI {
  constructor(private creds: MpacCreds) {}

  public async downloadTransactions(): Promise<RawTransaction[]> {
    const transactions = await this.downloadMarketplaceData('sales/transactions');
    if ((transactions as any).code === 401) throw new KnownError('MPAC_API_KEY is an invalid API key.');
    return transactions as RawTransaction[];
  }

  public async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    const licenses = await this.downloadMarketplaceData('licenses', 'endDate=2018-07-01');
    return licenses as RawLicense[];
  }

  public async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    const dates = dataInsightDateRanges();
    const promises = dates.map(async ({ startDate, endDate }) => {
      const json: RawLicense[] = await this.downloadMarketplaceData(
        'licenses',
        `withDataInsights=true&startDate=${startDate}&endDate=${endDate}`
      );
      progress.tick(`${startDate}-${endDate}`);
      return json;
    });
    const licenses = (await Promise.all(promises)).flat();
    return licenses;
  }

  private async downloadMarketplaceData<T>(subpath: string, queryParams: string = ''): Promise<T[]> {
    const reportingBaseUrl = `https://marketplace.atlassian.com/rest/2/vendors/${this.creds.sellerId}/reporting`;
    const url = `${reportingBaseUrl}/${subpath}/export${!queryParams.length ? '' : `?${queryParams}`}`;
    const res = await got.get(url, {
      throwHttpErrors: false,
      headers: {
        Authorization: 'Basic ' + Buffer.from(this.creds.user + ':' + this.creds.apiKey).toString('base64'),
      },
    });

    if (res.statusCode !== 200) {
      throw new KnownError(`Marketplace API: ${res.statusCode} ${res.statusMessage}`);
    }

    let text;
    try {
      text = res.body;
      return JSON.parse(text);
    } catch (e) {
      throw new AttachableError('Probably invalid Marketplace JSON.', text as string);
    }
  }
}
