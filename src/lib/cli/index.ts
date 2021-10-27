import CachedFileDownloader from "../io/downloader/cached-file-downloader.js";
import { Downloader } from "../io/downloader/downloader.js";
import LiveDownloader from '../io/downloader/live-downloader.js';
import ConsoleUploader from "../io/uploader/console-uploader.js";
import LiveUploader from "../io/uploader/live-uploader.js";
import { Uploader } from "../io/uploader/uploader.js";
import { LogLevel, logLevel } from "../log/logger.js";
import { sharedArgParser } from './arg-parser.js';

export function getIoFromCli() {
  const downloaderArg = sharedArgParser.getChoiceOrFail('--downloader', [
    'cached',
    'live'
  ]);

  const uploaderArg = sharedArgParser.getChoiceOrFail('--uploader', [
    'console',
    'live'
  ]);

  return {
    downloader: getDownloader(downloaderArg),
    uploader: getUploader(uploaderArg),
  };
}

function getDownloader(kind: 'cached' | 'live'): Downloader {
  switch (kind) {
    case 'live': return new LiveDownloader();
    case 'cached': return new CachedFileDownloader();
  }
}

function getUploader(kind: 'console' | 'live'): Uploader {
  switch (kind) {
    case 'live': return new LiveUploader();
    case 'console': return new ConsoleUploader({ verbose: logLevel >= LogLevel.Verbose });
  }
}
