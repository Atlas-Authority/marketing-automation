import chalk from "chalk";
import util from "util";

enum LogLevel {
  Error,
  Warn,
  Info,
}

class Logger {

  public level = LogLevel.Info;
  public readonly Levels = LogLevel;

  public error(prefix: string, ...args: any[]) { this.print(LogLevel.Error, prefix, ...args); }
  public warn(prefix: string, ...args: any[]) { this.print(LogLevel.Warn, prefix, ...args); }
  public info(prefix: string, ...args: any[]) { this.print(LogLevel.Info, prefix, ...args); }

  private print(level: LogLevel, prefix: string, ...args: any[]) {
    if (level > this.level) return;

    const first = levelPrefixes[level];
    const styledPrefix = chalk.magenta(prefix);

    const lastDataArg = args.pop();
    const printDataArg = (typeof lastDataArg !== 'string');
    if (!printDataArg) args.push(lastDataArg);

    const time = new Date().toLocaleString();
    const styledTime = chalk.dim.yellow(time);

    if (args.length > 0) {
      const firstLine = args.join(' ');
      for (const line of firstLine.split('\n')) {
        console.log([styledTime, first, styledPrefix, line].join(' '));
      }
    }

    if (printDataArg) {
      const spacer = args.length > 0 ? '  ' : '';
      const nextLineIndent = time.length + 1 + 4 + 1 + prefix.length + 1 + spacer.length;

      const formattedLastArg = formatted(lastDataArg, nextLineIndent);
      for (const line of formattedLastArg.split('\n')) {
        console.log([styledTime, first, styledPrefix, spacer + line].join(' '));
      }
    }
  }

  public setLevelFrom(levelString: string | undefined) {
    if (!levelString) return;
    switch (levelString.trim().toLowerCase()) {
      case 'error': this.level = LogLevel.Error; break;
      case 'warn': this.level = LogLevel.Warn; break;
      case 'info': this.level = LogLevel.Info; break;
    }
  }
}

const levelPrefixes = {
  [LogLevel.Error]: chalk.red('ERR!'),
  [LogLevel.Warn]: chalk.dim.redBright('WARN'),
  [LogLevel.Info]: chalk.green('info'),
};

function formatted(data: unknown, prefixLength: number) {
  return util.inspect(data, {
    breakLength: (process.stdout.columns || 200) - prefixLength,
    colors: true,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
}

const log = new Logger();
export default log;
