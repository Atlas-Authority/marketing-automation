import fs from 'fs';
import { URL } from 'url';
import log from './logger.js';

type DataDirPlace = 'in' | 'out' | 'cache';

export function writeFile(place: DataDirPlace, filename: string, contents: string | Buffer) {
  ensureDir(`../../../data`);
  ensureDir(`../../../data/${place}`);
  fs.writeFileSync(new URL(`../../../data/${place}/${filename}`, import.meta.url), contents);
}

export function readFile(place: DataDirPlace, filename: string) {
  const dir = `../../../data/${place}`;

  if (!fs.existsSync(new URL(dir, import.meta.url))) {
    log.error('Dev', `Data directory doesn't exist yet. First run the engine with --downloader=live`);
    process.exit(1);
  }

  return fs.readFileSync(new URL(`${dir}/${filename}`, import.meta.url));
}

export function readJsonFile(place: DataDirPlace, filename: string) {
  return JSON.parse(readFile(place, filename).toString('utf8'));
}

export function pathExists(place: DataDirPlace, filename: string) {
  const path = `../../../data/${place}/${filename}`;
  return fs.existsSync(new URL(path, import.meta.url));
}

function ensureDir(path: string) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    fs.mkdirSync(new URL(path, import.meta.url));
  }
}
