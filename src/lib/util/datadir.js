import fs from 'fs';
import { URL } from 'url';
import logger from './logger.js';

/**
 * @param {'in' | 'out' | 'cache'} place
 * @param {string} filename
 * @param {string | Buffer} contents
 */
export function writeFile(place, filename, contents) {
  ensureDir(`../../../data`);
  ensureDir(`../../../data/${place}`);
  fs.writeFileSync(new URL(`../../../data/${place}/${filename}`, import.meta.url), contents);
}

/**
 * @param {'in' | 'out' | 'cache'} place
 * @param {string} filename
 */
export function readFile(place, filename) {
  const dir = `../../../data/${place}`;

  if (!fs.existsSync(new URL(dir, import.meta.url))) {
    logger.error('Dev', `Data directory doesn't exist yet. First run the engine with --downloader=live`);
    process.exit(1);
  }

  return fs.readFileSync(new URL(`${dir}/${filename}`, import.meta.url));
}

/**
 * @param {'in' | 'out' | 'cache'} place
 * @param {string} filename
 */
export function readJsonFile(place, filename) {
  return JSON.parse(readFile(place, filename).toString('utf8'));
}

/**
 * @param {'in' | 'out' | 'cache'} place
 * @param {string} filename
 */
export function pathExists(place, filename) {
  const path = `../../../data/${place}/${filename}`;
  return fs.existsSync(new URL(path, import.meta.url));
}

/**
 * @param {string} path
 */
function ensureDir(path) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    fs.mkdirSync(new URL(path, import.meta.url));
  }
}
