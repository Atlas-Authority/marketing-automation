import chalk from "chalk";
import { MultiBar, Presets, SingleBar } from "cli-progress";
import { Logger } from ".";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export class MultiDownloadLogger {

  constructor(private log: Logger) { }

  private multibar = new MultiBar({
    format: `${chalk.cyan('[{bar}]')} {name}`,
  }, Presets.rect);

  public async wrap<T>(name: string, fn: (progress: Progress) => Promise<T>): Promise<T> {
    const line = this.makeLine(name);
    const result = await fn(line);
    line.done();
    return result;
  }

  private makeLine(name: string) {
    let bar = this.multibar.create(1, 0, { name });
    if (bar) return new AnimatedProgressBar(bar);
    return new SimpleLogProgress(this.log, name);
  }

  public done() {
    this.multibar.stop();
  }

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

  public constructor(private log: Logger, private name: string) { }

  public setCount(count: number) {
    this.log.printInfo('Downloader', `Downloading ${this.name} (${count} call${count === 1 ? '' : 's'})`);
  }

  public tick(moreInfo?: string) {
    moreInfo = moreInfo ? ` (${moreInfo})` : '';
    this.log.printInfo('Downloader', `Downloading ${this.name} ${moreInfo}`);
  }

  public done() {
    this.log.printInfo('Downloader', `Done downloading ${this.name}`);
  }

}