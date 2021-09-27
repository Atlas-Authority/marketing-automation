import { MultiBar, Presets } from 'cli-progress';
import colors from 'colors';
import log from './logger.js';
import { DownloadLogger } from '../downloader/downloader.js';

export class MultiDownloadLogger {

  multibar = new MultiBar({
    format: `${colors.cyan('[{bar}]')} {name}`,
  }, Presets.rect);

  makeDownloadLogger(name: string): DownloadLogger {
    let bar = this.multibar.create(1, 0, { name });
    if (bar) {
      return {
        prepare(count: number) {
          bar.setTotal(count);
        },
        tick(moreInfo?: string) {
          bar.increment();
        },
      };
    }
    else {
      return {
        prepare(count: number) {
          log.info('Live Downloader', `Downloading ${name} (${count} call${count === 1 ? '' : 's'})`);
        },
        tick(moreInfo?: string) {
          moreInfo = moreInfo ? ` (${moreInfo})` : '';
          log.info('Live Downloader', `Done downloading ${name} ${moreInfo}`);
        },
      };
    }
  }

  done() {
    this.multibar.stop();
  }

}
