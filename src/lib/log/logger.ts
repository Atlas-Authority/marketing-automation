import util from 'util';
import config, { LogLevel } from '../config/index.js';

let enabled = true;

const great = '\x1b[32m';
const nerve = '\x1b[43;30;1m';
const scary = '\x1b[40;31;1m';
const reset = '\x1b[0m';
const royal = '\x1b[35m';
const relax = '\x1b[33;2m';

class Logger {

  enable() { enabled = true; }
  disable() { enabled = false; }

  error(prefix: string, ...args: any[]) { print(LogLevel.Error, prefix, ...args); }
  warn(prefix: string, ...args: any[]) { print(LogLevel.Warn, prefix, ...args); }
  info(prefix: string, ...args: any[]) { print(LogLevel.Info, prefix, ...args); }
  verbose(prefix: string, ...args: any[]) { print(LogLevel.Verbose, prefix, ...args); }
  detailed(prefix: string, ...args: any[]) { print(LogLevel.Detailed, prefix, ...args); }

}

const log = new Logger();
export default log;

const levelPrefixes = {
  [LogLevel.Error]: `${scary}ERR!${reset}`,
  [LogLevel.Warn]: `${nerve}WARN${reset}`,
  [LogLevel.Info]: `${great}info${reset}`,
  [LogLevel.Verbose]: `${great}verb${reset}`,
  [LogLevel.Detailed]: `${great}....${reset}`,
};

function print(level: LogLevel, prefix: string, ...args: any[]) {
  if (!enabled) return;
  if (level > config.logLevel) return;

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

function formatted(data: unknown, prefixLength: number) {
  return util.inspect(data, {
    breakLength: (process.stdout.columns || 200) - prefixLength,
    colors: true,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
