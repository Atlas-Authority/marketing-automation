import csvStringify from 'csv-stringify/lib/es5/sync.js';
import flatten from 'flat';
import config from './config.js';
import * as datadir from './datadir.js';
import logger from './logger.js';

function saveArrayToCsv(filename: string, array: any[]) {
  if (config.isProduction || config.isTest) return;

  if (array[0] instanceof Array) {
    array = array.flatMap(innerArray => innerArray.concat([{}]));
  }

  array = array.map(o => flatten(o, { delimiter: '_' }));

  const out = csvStringify(array, { header: true });
  datadir.writeFile('out', filename, out);
  logger.info('Dev', 'Saved data to:', filename);
}

export function saveToJson(filename: string, object: unknown) {
  if (config.isProduction || config.isTest) return;

  const out = JSON.stringify(object, null, 2);
  datadir.writeFile('out', filename, out);
  logger.info('Dev', 'Saved data to:', filename);
}

type OutputFormat = 'json' | 'csv' | 'both';

export function saveForInspection(filename: string, array: unknown[], formats: OutputFormat = 'both') {
  if (formats !== 'csv') saveToJson(`${filename}.json`, array);
  if (formats !== 'json') saveArrayToCsv(`${filename}.csv`, array);
}
