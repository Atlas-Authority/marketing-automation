import util from 'util';
import config from './config.js';

let enabled = true;
export function enable() { enabled = true; }
export function disable() { enabled = false; }

const great = '\x1b[32m';
const nerve = '\x1b[43;30;1m';
const scary = '\x1b[40;31;1m';
const reset = '\x1b[0m';
const royal = '\x1b[35m';
const relax = '\x1b[33;2m';

export enum LogLevel {
  Error,
  Warn,
  Info,
  Verbose,
}

const configLogLevel = logLevelFromString(config.logLevel);

export function logLevelFromString(level: string) {
  switch (level) {
    case 'error': return LogLevel.Error;
    case 'warn': return LogLevel.Warn;
    case 'info': return LogLevel.Info;
    case 'verbose': return LogLevel.Verbose;
    default: return LogLevel.Warn;
  }
}

export const info = log.bind(null, LogLevel.Info);
export const verbose = log.bind(null, LogLevel.Verbose);
export const warn = log.bind(null, LogLevel.Warn);
export const error = log.bind(null, LogLevel.Error);

const levelPrefixes = {
  [LogLevel.Info]: `${great}info${reset}`,
  [LogLevel.Warn]: `${nerve}WARN${reset}`,
  [LogLevel.Error]: `${scary}ERR!${reset}`,
  [LogLevel.Verbose]: `${great}....${reset}`,
};

function log(level: LogLevel, prefix: string, ...args: any[]) {
  if (!enabled) return;
  if (level > configLogLevel) return;

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

export function formatted(data: unknown, prefixLength: number) {
  return util.inspect(data, {
    breakLength: (process.stdout.columns || 200) - prefixLength,
    colors: true,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
