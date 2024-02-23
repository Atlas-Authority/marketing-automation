import got from 'got';
import { Progress } from '../../log/download';
import { KnownError, AttachableError } from '../../util/errors';
import { RawTransaction, RawLicense } from '../raw';
import { MpacCreds } from './api';

type ExportProcessInfo = {
  exportId: string;
  statusUrl: string;
  downloadUrl: string;
};

const MARKETPLACE_BASE_URL = 'https://marketplace.atlassian.com';

export class AsyncMarketplaceAPI {
  constructor(private creds: MpacCreds, private statusPollingTime: number = 5000) {}

  public async downloadTransactions(): Promise<RawTransaction[]> {
    const transactions = await this.downloadMarketplaceData('sales/transactions');
    return transactions as RawTransaction[];
  }

  public async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    const licenses = await this.downloadMarketplaceData('licenses', 'endDate=2018-07-01');
    return licenses as RawLicense[];
  }

  public async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    const licenses = await this.downloadMarketplaceData('licenses', 'startDate=2018-07-01');
    progress.tick();
    return licenses as RawLicense[];
  }

  private async downloadMarketplaceData<T>(subpath: string, queryParams: string = ''): Promise<T[]> {
    const reportingBaseUrl = `${MARKETPLACE_BASE_URL}/rest/2/vendors/${this.creds.sellerId}/reporting`;
    const exportProcessInfo = await this.initiateExport(
      reportingBaseUrl,
      subpath,
      !queryParams.length ? '' : `?${queryParams}`
    );
    await this.awaitExportFinished(exportProcessInfo);
    return await this.getResult(exportProcessInfo);
  }

  private async initiateExport(baseUrl: string, subpath: string, queryParams: string): Promise<ExportProcessInfo> {
    const url = `${baseUrl}/${subpath}/async/export${queryParams}`;
    const response = await this.makeMarketplaceRequest(url, true);
    return {
      statusUrl: `${MARKETPLACE_BASE_URL}${response._links.status.href}`,
      downloadUrl: `${MARKETPLACE_BASE_URL}${response._links.download.href}`,
      exportId: response.export.id! as string,
    };
  }

  private async awaitExportFinished(exportProcessInfo: ExportProcessInfo): Promise<void> {
    while (true) {
      const response = await this.makeMarketplaceRequest(exportProcessInfo.statusUrl);
      const status = response.export.status;
      if (status === 'COMPLETED' || status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, this.statusPollingTime));
    }
  }

  private async getResult(exportProcessInfo: ExportProcessInfo) {
    return await this.makeMarketplaceRequest(exportProcessInfo.downloadUrl);
  }

  private async makeMarketplaceRequest(url: string, isPostMethod: boolean = false): Promise<any> {
    const method = isPostMethod ? got.post : got.get;
    const res = await method(url, {
      throwHttpErrors: false,
      headers: {
        Authorization: 'Basic ' + Buffer.from(this.creds.user + ':' + this.creds.apiKey).toString('base64'),
      },
    });

    if (res.statusCode !== 200) {
      throw new KnownError(`Marketplace API: ${res.statusCode} ${res.statusMessage}`);
    }

    let body;
    try {
      body = res.body;
      return JSON.parse(body);
    } catch (e) {
      throw new AttachableError('Probably invalid Marketplace JSON.', body as string);
    }
  }
}
