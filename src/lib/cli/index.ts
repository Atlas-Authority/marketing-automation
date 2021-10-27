import CachedFileDownloader from "../io/downloader/cached-file-downloader.js";
import { Downloader } from "../io/downloader/downloader.js";
import LiveDownloader from '../io/downloader/live-downloader.js';
import ConsoleUploader from "../io/uploader/console-uploader.js";
import LiveUploader from "../io/uploader/live-uploader.js";
import { Uploader } from "../io/uploader/uploader.js";
import { LogLevel, logLevel } from "../log/logger.js";
import { sharedArgParser } from './arg-parser.js';

export function getIoFromCli() {
  return {
    downloader: sharedArgParser.getChoiceOrFail<Downloader>('--downloader', {
      'live': () => new LiveDownloader(),
      'cached': () => new CachedFileDownloader(),
    }),
    uploader: sharedArgParser.getChoiceOrFail<Uploader>('--uploader', {
      'live': () => new LiveUploader(),
      'console': () => new ConsoleUploader({ verbose: logLevel >= LogLevel.Verbose }),
    }),
  };
}
