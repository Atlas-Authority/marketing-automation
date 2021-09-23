import CachedFileDownloader from "../downloader/cached-file-downloader.js";
import { Downloader } from "../downloader/downloader.js";
import LiveDownloader from '../downloader/live-downloader.js';
import ConsoleUploader from "../uploader/console-uploader.js";
import LiveUploader from "../uploader/live-uploader.js";
import { Uploader } from "../uploader/uploader.js";
import { ArgParser } from './arg-parser.js';
import config, { LogLevel } from "./config/index.js";

export function getCliOptions() {
  const argParser = new ArgParser(process.argv.slice(2));

  const logLevelString = argParser.get('--loglevel');
  if (logLevelString) {
    const logLevel = logLevelFromString(logLevelString.trim().toLowerCase());
    if (logLevel !== null) {
      config.logLevel = logLevel;
    }
  }

  const downloader = argParser.getChoiceOrFail<Downloader>('--downloader', {
    'live': () => new LiveDownloader(),
    'cached': () => new CachedFileDownloader(),
  });

  const uploader = argParser.getChoiceOrFail<Uploader>('--uploader', {
    'live': () => new LiveUploader(),
    'console': () => new ConsoleUploader({ verbose: config.logLevel >= LogLevel.Verbose }),
  });

  const cachedFns = argParser.get('--cached-fns')?.split(',') || [];
  config.cache.fns = cachedFns;

  argParser.failIfExtraOpts();

  return {
    downloader,
    uploader,
  };
}

function logLevelFromString(level: string) {
  switch (level) {
    case 'error': return LogLevel.Error;
    case 'warn': return LogLevel.Warn;
    case 'info': return LogLevel.Info;
    case 'verbose': return LogLevel.Verbose;
    case 'detailed': return LogLevel.Detailed;
    default: return null;
  }
}
