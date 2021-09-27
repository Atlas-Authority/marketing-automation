import assert from 'assert';
import * as dotenv from 'dotenv';

dotenv.config();

export function required(key: string) {
  const value = process.env[key];
  assert.ok(value, `ENV key ${key} is required`);
  return value;
}

export function optional(key: string) {
  return process.env[key];
}
