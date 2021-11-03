import { Remote } from "../io/interfaces.js";
import LiveRemote from '../io/live-remote.js';
import { MemoryRemote } from "../io/memory-remote.js";
import { cliParams } from './arg-parser.js';

export function getIoFromCli() {
  return {
    downloader: cliParams.getChoiceOrFail<Remote>('--downloader', {
      'cached': getSingletonMemoryRemote,
      'live': () => new LiveRemote(),
    }),
    uploader: cliParams.getChoiceOrFail<Remote>('--uploader', {
      'console': getSingletonMemoryRemote,
      'live': () => new LiveRemote(),
    }),
  };
}

let memoryRemote: MemoryRemote | undefined;
function getSingletonMemoryRemote() {
  if (!memoryRemote) memoryRemote = new MemoryRemote();
  return memoryRemote;
}
