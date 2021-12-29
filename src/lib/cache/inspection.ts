import csvStringify from "csv-stringify/lib/es5/sync.js";
import flatten from "flat";
import log from "../log/logger";
import { isProduction, isTest } from "../parameters/env-config";
import DataDir from "./datadir";

function saveArrayToCsv(filename: string, array: any[]) {
  if (isProduction || isTest) return;

  if (array[0] instanceof Array) {
    array = array.flatMap(innerArray => innerArray.concat([{}]));
  }

  array = array.map(o => flatten(o, { delimiter: '_' }));

  const out = csvStringify(array, { header: true });
  DataDir.out.file(filename).writeText(out);
  log.info('Dev', 'Saved data to:', filename);
}

function saveToJson(filename: string, object: unknown) {
  if (isProduction || isTest) return;

  DataDir.out.file(filename).writeJson(object);
  log.info('Dev', 'Saved data to:', filename);
}

type OutputFormat = 'json' | 'csv' | 'both';

export function saveForInspection(filename: string, array: unknown[], formats: OutputFormat = 'both') {
  if (formats !== 'csv') saveToJson(`${filename}.json`, array);
  if (formats !== 'json') saveArrayToCsv(`${filename}.csv`, array);
}
