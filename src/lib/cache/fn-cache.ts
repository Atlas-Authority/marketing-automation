import { cliParams } from "../cli/arg-parser.js";
import config from '../config/index.js';
import log from '../log/logger.js';
import DataDir from "./datadir.js";

const cachedFns = cliParams.get('--cached-fns')?.split(',') || [];

export function fnOrCache<T>(filename: string, fn: () => T): T {
  const skipCacheFully = (config.isProduction || config.isTest);

  const useCache = (
    !skipCacheFully &&
    cachedFns.includes(filename) &&
    DataDir.cache.pathExists(filename)
  );

  if (useCache) {
    const red = '\x1b[31;1m';
    const reset = '\x1b[0m';
    log.warn('Dev', `${red}CACHED FUNCTION MODE ENABLED FOR:${reset}`);
    log.warn('Dev', fn.toString());
    log.warn('Dev', `${red}FUNCTION SKIPPED; RETURNING CACHED VALUE${reset}`);
    return DataDir.cache.readJsonFile(filename);
  }
  else {
    const data = fn();
    if (!skipCacheFully) {
      DataDir.cache.writeJsonFile(filename, data);
    }
    return data;
  }
}
