import v8 from "v8";
import { cliParams } from "../cli/arg-parser.js";
import config from '../config/index.js';
import log from '../log/logger.js';
import { DataDir } from "./datadir.js";

const cachedFns = cliParams.get('--cached-fns')?.split(',') || [];

export function fnOrCache<T>(filename: string, fn: () => T): T {
  if (config.isProduction || config.isTest) return fn();

  let live = !cachedFns.includes(filename);
  if (!live && !DataDir.cache.pathExists(filename)) live = true;

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
    DataDir.cache.writeFile(filename, buffer);
    return data;
  }
  else {
    const buffer = DataDir.cache.readFile(filename);
    return v8.deserialize(buffer);
  }
}
