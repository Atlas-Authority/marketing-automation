import CachedFileDownloader from "../downloader/cached-file-downloader.js";
import LiveDownloader from '../downloader/live-downloader.js';
import ConsoleUploader from "../uploader/console-uploader.js";
import LiveUploader from "../uploader/live-uploader.js";
import { ArgParser } from './arg-parser.js';
import config from "./config.js";

export function getCliOptions() {
  const argParser = new ArgParser(process.argv.slice(2));

  const downloader = argParser.getChoiceOrFail('--downloader',
    ({
      'live': () => new LiveDownloader(),
      'cached': () => new CachedFileDownloader(),
    }) as { [key: string]: () => Downloader }
  );

  const uploader = argParser.getChoiceOrFail('--uploader',
    ({
      'live': () => new LiveUploader(),
      'console-quiet': () => new ConsoleUploader({ verbose: false }),
      'console-verbose': () => new ConsoleUploader({ verbose: true }),
    }) as { [key: string]: () => Uploader }
  );

  const cachedFns = argParser.get('--cached-fns')?.split(',') || [];
  config.cache.fns = cachedFns;

  argParser.failIfExtraOpts();

  return {
    downloader,
    uploader,
  };
}
