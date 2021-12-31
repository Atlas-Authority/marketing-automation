import got from 'got';
import { DateTime, Duration, Interval } from 'luxon';
import { RawLicense, RawTransaction } from '../../model/marketplace/raw';
import { MpacCreds } from '../../parameters/interfaces';
import { AttachableError, KnownError } from '../../util/errors';
import cache from '../cache';
import { MarketplaceService, Progress } from '../interfaces';


export class LiveMarketplaceService implements MarketplaceService {

  constructor(private creds: MpacCreds) { }

  public async downloadTransactions(): Promise<RawTransaction[]> {
    const transactions = await this.downloadMarketplaceData('/sales/transactions/export');
    if ((transactions as any).code === 401) throw new KnownError("MPAC_API_KEY is an invalid API key.");
    return cache('transactions.json', transactions as RawTransaction[]);
  }

  public async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    return cache('licenses-without.json',
      await this.downloadMarketplaceData('/licenses/export?endDate=2018-07-01'));
  }

  public async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    const dates = dataInsightDateRanges();
    progress.setCount(dates.length);
    const promises = dates.map(async ({ startDate, endDate }) => {
      const json: RawLicense[] = await this.downloadMarketplaceData(`/licenses/export?withDataInsights=true&startDate=${startDate}&endDate=${endDate}`);
      progress.tick(`${startDate}-${endDate}`);
      return json;
    });
    return cache('licenses-with.json',
      (await Promise.all(promises)).flat());
  }

  private async downloadMarketplaceData<T>(subpath: string): Promise<T[]> {
    const res = await got.get(`https://marketplace.atlassian.com/rest/2/vendors/${this.creds.sellerId}/reporting${subpath}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.creds.user + ':' + this.creds.apiKey).toString('base64'),
      },
    });

    let text;
    try {
      text = res.body;
      return JSON.parse(text);
    }
    catch (e) {
      throw new AttachableError('Probably invalid Marketplace JSON.', text as string);
    }
  }

}

function dataInsightDateRanges() {
  return Interval.fromDateTimes(
    DateTime.local(2018, 7, 1),
    DateTime.local()
  ).splitBy(Duration.fromObject({ months: 2 })).map(int => ({
    startDate: int.start.toISODate(),
    endDate: int.end.toISODate(),
  }));
}
