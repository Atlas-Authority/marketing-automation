import { Downloader } from "../io/downloader/downloader.js";
import LiveDownloader from '../io/downloader/live-downloader.js';
import { MemoryRemote } from "../io/memory-remote.js";
import LiveUploader from "../io/uploader/live-uploader.js";
import { Uploader } from "../io/uploader/uploader.js";
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

  if (downloaderArg === 'cached' && uploaderArg === 'console') {
    const memoryRemote = new MemoryRemote();
    return {
      downloader: memoryRemote,
      uploader: memoryRemote,
    };
  }

  return {
    downloader: getDownloader(downloaderArg),
    uploader: getUploader(uploaderArg),
  };
}

function getDownloader(kind: 'cached' | 'live'): Downloader {
  switch (kind) {
    case 'live': return new LiveDownloader();
    case 'cached': return new MemoryRemote();
  }
}

function getUploader(kind: 'console' | 'live'): Uploader {
  switch (kind) {
    case 'live': return new LiveUploader();
    case 'console': return new MemoryRemote();
  }
}
