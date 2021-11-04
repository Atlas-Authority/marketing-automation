import DataDir from '../cache/datadir.js';
import env from '../parameters/env.js';

export default function cache<T>(file: string, data: T): T {
  if (!env.isProduction) {
    DataDir.in.file(file).writeJson(data);
  }
  return data;
}
