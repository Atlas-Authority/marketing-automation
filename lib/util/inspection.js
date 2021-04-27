import csvStringify from 'csv-stringify/lib/es5/sync.js';
import flatten from 'flat';
import config from './config.js';
import * as datadir from './datadir.js';
import * as logger from './logger.js';

/**
 * @param {string} filename
 * @param {any[]} array
 */
function saveArrayToCsv(filename, array) {
  if (config.isProduction || config.isTest) return;

  if (array[0] instanceof Array) {
    array = array.flatMap(innerArray => innerArray.concat([{}]));
  }

  array = array.map(o => flatten(o, { delimiter: '_' }));

  const out = csvStringify(array, { header: true });
  datadir.writeFile('out', filename, out);
  logger.info('Dev', 'Saved data to:', filename);
}

/**
 * @param {string} filename
 * @param {unknown} object
 */
export function saveToJson(filename, object) {
  if (config.isProduction || config.isTest) return;

  const out = JSON.stringify(object, null, 2);
  datadir.writeFile('out', filename, out);
  logger.info('Dev', 'Saved data to:', filename);
}

/**
 * @param {string} filename
 * @param {unknown[]} array
 * @param {'json' | 'csv' | 'both'} formats
 */
export function saveForInspection(filename, array, formats = 'both') {
  if (formats !== 'csv') saveToJson(`${filename}.json`, array);
  if (formats !== 'json') saveArrayToCsv(`${filename}.csv`, array);
}
