import config from './config.js';
import * as logger from './logger.js';

/**
 * @param {object} options
 * @param {() => Promise<void>} options.work
 * @param {(errors: Error[]) => Promise<void>} options.failed
 */
export default function run({ work, failed }) {
  const normalInterval = config.engine.runInterval;
  const errorInterval = config.engine.retryInterval;
  const errorTries = config.engine.retryTimes;

  logger.info('Runner', 'Running with options:', config.engine);

  /** @type {Error[]} */
  const errors = [];
  run();

  async function run() {
    try {
      await work();

      if (errors.length > 0) {
        errors.length = 0;
      }

      logger.info('Runner', `Finished successfully; waiting ${normalInterval} for next loop.`);
      setTimeout(run, parseTimeToMs(normalInterval));
    }
    catch (e) {
      logger.error('Runner', 'Error:', e);
      errors.push(e);

      const longTermFailure = (errors.length % errorTries === 0);
      const waitTime = longTermFailure ? normalInterval : errorInterval;

      logger.warn('Runner', `Run canceled by error. Trying again in ${waitTime}.`);

      setTimeout(run, parseTimeToMs(waitTime));

      if (longTermFailure) {
        await failed(errors);
        errors.length = 0;
      }
    }
  }
}

/**
 * @param {string} str
 */
function parseTimeToMs(str) {
  const UNITS = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
  };

  const RE = /([0-9]+)(s|m|h)/g;
  return ([...str.matchAll(RE)]
    .map(([, amt, unit]) => {
      const key = unit.toLowerCase();
      return +amt * (key in UNITS
        ? UNITS[/** @type {keyof UNITS} */(key)]
        : 1);
    })
    .reduce(
      (a, b) => a + b,
      0));
}
