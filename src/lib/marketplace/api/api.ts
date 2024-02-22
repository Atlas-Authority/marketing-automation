import { DateTime, Duration, Interval } from 'luxon';
import { mpacCredsFromENV } from '../../config/env';
import { Progress } from '../../log/download';
import { RawLicense, RawTransaction } from '../raw';
import { SyncMarketplaceAPI } from './syncApi';

export interface MpacCreds {
  user: string;
  apiKey: string;
  sellerId: string;
}

export interface MultiMpacCreds {
  user: string;
  apiKey: string;
  sellerIds: string[];
}

export class MarketplaceAPI {
  private creds: MultiMpacCreds = mpacCredsFromENV();

  private singleApis = this.creds.sellerIds.map(
    (sellerId) =>
      new SyncMarketplaceAPI({
        apiKey: this.creds.apiKey,
        user: this.creds.user,
        sellerId,
      })
  );

  public async downloadTransactions(): Promise<RawTransaction[]> {
    const transactionGroups = await Promise.all(this.singleApis.map((api) => api.downloadTransactions()));
    return transactionGroups.flat();
  }

  public async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    const licenseGroups = await Promise.all(this.singleApis.map((api) => api.downloadLicensesWithoutDataInsights()));
    return licenseGroups.flat();
  }

  public async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    const dates = dataInsightDateRanges();
    progress.setCount(dates.length * this.singleApis.length);

    const licenseGroups = await Promise.all(
      this.singleApis.map((api) => api.downloadLicensesWithDataInsights(progress))
    );
    return licenseGroups.flat();
  }
}

export function dataInsightDateRanges() {
  return Interval.fromDateTimes(DateTime.local(2018, 7, 1), DateTime.local())
    .splitBy(Duration.fromObject({ months: 2 }))
    .map((int) => ({
      startDate: int.start.toISODate(),
      endDate: int.end.toISODate(),
    }));
}
