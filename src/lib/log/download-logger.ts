import { MultiBar, Presets, SingleBar } from 'cli-progress';
import colors from 'colors';
import { Progress } from '../io/interfaces.js';
import log from './logger.js';

export class MultiDownloadLogger {

  multibar = new MultiBar({
    format: `${colors.cyan('[{bar}]')} {name}`,
  }, Presets.rect);

  async wrap<T>(name: string, fn: (progress: Progress) => Promise<T>): Promise<T> {
    const line = this.makeLine(name);
    const result = await fn(line);
    line.done();
    return result;
  }

  private makeLine(name: string): InternalProgress {
    let bar = this.multibar.create(1, 0, { name });
    if (bar) return new AnimatedProgressBar(bar);
    return new SimpleLogProgress(name);
  }

  done() {
    this.multibar.stop();
  }

}

interface InternalProgress extends Progress {
  done(): void;
}

class AnimatedProgressBar {

  called = 0;
  constructor(private bar: SingleBar) { }

  setCount(count: number) {
    this.bar.setTotal(count);
    this.called++;
  }

  tick(moreInfo?: string) {
    this.bar.increment();
    this.called++;
  }

  done() {
    if (this.called === 0) {
      this.bar.increment();
    }
  }

}

class SimpleLogProgress {

  constructor(private name: string) { }

  setCount(count: number) {
    log.info('Live Downloader', `Downloading ${this.name} (${count} call${count === 1 ? '' : 's'})`);
  }

  tick(moreInfo?: string) {
    moreInfo = moreInfo ? ` (${moreInfo})` : '';
    log.info('Live Downloader', `Downloading ${this.name} ${moreInfo}`);
  }

  done() {
    log.info('Live Downloader', `Done downloading ${this.name}`);
  }

}
