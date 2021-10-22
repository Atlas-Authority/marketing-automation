import v8 from "v8";
import config from '../config/index.js';
import log from '../log/logger.js';
import * as datadir from './datadir.js';

export function fnOrCache<T>(filename: string, fn: () => T): T {
  if (config.isProduction || config.isTest) return fn();

  let live = !config.cache.fns.includes(filename);
  if (!live && !datadir.pathExists('cache', filename)) live = true;

  if (!live) {
    const red = '\x1b[31;1m';
    const reset = '\x1b[0m';
    log.warn('Dev', `${red}CACHED FUNCTION MODE ENABLED FOR:${reset}`);
    log.warn('Dev', fn.toString());
    log.warn('Dev', `${red}FUNCTION SKIPPED; RETURNING CACHED VALUE${reset}`);
  }

  if (live) {
    const data = fn();
    const buffer = v8.serialize(data);
    datadir.writeFile('cache', filename, buffer);
    return data;
  }
  else {
    const buffer = datadir.readFile('cache', filename);
    return v8.deserialize(buffer);
  }
}
