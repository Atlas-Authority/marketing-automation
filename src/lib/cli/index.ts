import { Downloader, Uploader } from "../io/interfaces.js";
import LiveDownloader from '../io/live-downloader.js';
import LiveUploader from "../io/live-uploader.js";
import { MemoryRemote } from "../io/memory-remote.js";
import { sharedArgParser } from './arg-parser.js';

export function getIoFromCli() {
  return {
    downloader: sharedArgParser.getChoiceOrFail<Downloader>('--downloader', {
      'cached': getSingletonMemoryRemote,
      'live': () => new LiveDownloader(),
    }),
    uploader: sharedArgParser.getChoiceOrFail<Uploader>('--uploader', {
      'console': getSingletonMemoryRemote,
      'live': () => new LiveUploader(),
    }),
  };
}

let memoryRemote: MemoryRemote | undefined;
function getSingletonMemoryRemote() {
  if (!memoryRemote) memoryRemote = new MemoryRemote();
  return memoryRemote;
}
