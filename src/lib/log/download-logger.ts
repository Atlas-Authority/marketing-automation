import chalk from 'chalk';
import { MultiBar, Presets, SingleBar } from 'cli-progress';
import { Progress } from '../io/interfaces.js';
import log from './logger.js';

export class MultiDownloadLogger {

  private multibar = new MultiBar({
    format: `${chalk.cyan('[{bar}]')} {name}`,
  }, Presets.rect);

  public async wrap<T>(name: string, fn: (progress: Progress) => Promise<T>): Promise<T> {
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

  public done() {
    this.multibar.stop();
  }

}

interface InternalProgress extends Progress {
  done(): void;
}

class AnimatedProgressBar {

  private called = 0;
  public constructor(private bar: SingleBar) { }

  public setCount(count: number) {
    this.bar.setTotal(count);
    this.called++;
  }

  public tick(moreInfo?: string) {
    this.bar.increment();
    this.called++;
  }

  public done() {
    if (this.called === 0) {
      this.bar.increment();
    }
  }

}

class SimpleLogProgress {

  public constructor(private name: string) { }

  public setCount(count: number) {
    log.info('Downloader', `Downloading ${this.name} (${count} call${count === 1 ? '' : 's'})`);
  }

  public tick(moreInfo?: string) {
    moreInfo = moreInfo ? ` (${moreInfo})` : '';
    log.info('Downloader', `Downloading ${this.name} ${moreInfo}`);
  }

  public done() {
    log.info('Downloader', `Done downloading ${this.name}`);
  }

}
