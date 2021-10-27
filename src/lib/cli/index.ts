import { Downloader, Uploader } from "../io/interfaces.js";
import LiveDownloader from '../io/live-downloader.js';
import LiveUploader from "../io/live-uploader.js";
import { MemoryRemote } from "../io/memory-remote.js";
import { sharedArgParser } from './arg-parser.js';

export function getIoFromCli() {
  return {
    downloader: getDownloader(sharedArgParser.getChoiceOrFail('--downloader', [
      'cached',
      'live'
    ])),
    uploader: getUploader(sharedArgParser.getChoiceOrFail('--uploader', [
      'console',
      'live'
    ])),
  };
}

function getDownloader(kind: 'cached' | 'live'): Downloader {
  switch (kind) {
    case 'live': return new LiveDownloader();
    case 'cached': return getSingletonMemoryRemote();
  }
}

function getUploader(kind: 'console' | 'live'): Uploader {
  switch (kind) {
    case 'live': return new LiveUploader();
    case 'console': return getSingletonMemoryRemote();
  }
}

let memoryRemote: MemoryRemote | undefined;
function getSingletonMemoryRemote() {
  if (!memoryRemote) memoryRemote = new MemoryRemote();
  return memoryRemote;
}
