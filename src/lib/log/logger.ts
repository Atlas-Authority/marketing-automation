import util from 'util';
import { cliParams } from '../cli/arg-parser.js';

enum LogLevel {
  Error,
  Warn,
  Info,
  Verbose,
  Detailed,
}

class Logger {

  public level = logLevelFromCliString(cliParams.get('--loglevel'));
  public readonly Levels = LogLevel;

  error(prefix: string, ...args: any[]) { this.print(LogLevel.Error, prefix, ...args); }
  warn(prefix: string, ...args: any[]) { this.print(LogLevel.Warn, prefix, ...args); }
  info(prefix: string, ...args: any[]) { this.print(LogLevel.Info, prefix, ...args); }
  verbose(prefix: string, ...args: any[]) { this.print(LogLevel.Verbose, prefix, ...args); }
  detailed(prefix: string, ...args: any[]) { this.print(LogLevel.Detailed, prefix, ...args); }

  private print(level: LogLevel, prefix: string, ...args: any[]) {
    if (level > this.level) return;

    const first = levelPrefixes[level];
    const styledPrefix = `${royal}${prefix}${reset}`;

    const lastDataArg = args.pop();
    const printDataArg = (typeof lastDataArg !== 'string');
    if (!printDataArg) args.push(lastDataArg);

    const time = new Date().toLocaleString();
    const styledTime = `${relax}${time}${reset}`;

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

}

const great = '\x1b[32m';
const nerve = '\x1b[43;30;1m';
const scary = '\x1b[40;31;1m';
const reset = '\x1b[0m';
const royal = '\x1b[35m';
const relax = '\x1b[33;2m';

const levelPrefixes = {
  [LogLevel.Error]: `${scary}ERR!${reset}`,
  [LogLevel.Warn]: `${nerve}WARN${reset}`,
  [LogLevel.Info]: `${great}info${reset}`,
  [LogLevel.Verbose]: `${great}verb${reset}`,
  [LogLevel.Detailed]: `${great}....${reset}`,
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

function logLevelFromCliString(level: string | undefined) {
  switch (level?.trim().toLowerCase()) {
    case 'error': return LogLevel.Error;
    case 'warn': return LogLevel.Warn;
    case 'info': return LogLevel.Info;
    case 'verbose': return LogLevel.Verbose;
    case 'detailed': return LogLevel.Detailed;
    default: return LogLevel.Verbose;
  }
}

const log = new Logger();
export default log;
