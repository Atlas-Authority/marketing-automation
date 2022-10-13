import chalk from "chalk";
import { MultiBar, Presets, SingleBar } from "cli-progress";
import { ConsoleLogger } from "./console";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export class MultiDownloadLogger {

  constructor(private console: ConsoleLogger) { }

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
    const bar = this.multibar.create(1, 0, { name });
    if (bar) return new AnimatedProgressBar(bar);
    return new SimpleLogProgress(this.console, name);
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

  public constructor(private console: ConsoleLogger, private name: string) { }

  public setCount(count: number) {
    this.console.printInfo('Downloader', `Downloading ${this.name} (${count} call${count === 1 ? '' : 's'})`);
  }

  public tick(moreInfo?: string) {
    moreInfo = moreInfo ? ` (${moreInfo})` : '';
    this.console.printInfo('Downloader', `Downloading ${this.name} ${moreInfo}`);
  }

  public done() {
    this.console.printInfo('Downloader', `Done downloading ${this.name}`);
  }

}
