import log from "../log/logger";
import env from "../parameters/env-config";

export default async function run({ work, failed }: {
  work: () => Promise<void>,
  failed: (errors: Error[]) => Promise<void>,
}) {
  log.info('Runner', 'Starting with options:', env.loop);
  const normalInterval = env.loop.runInterval;
  const errorInterval = env.loop.retryInterval;
  const errorTries = env.loop.retryTimes;

  log.info('Runner', 'Running loop');
  const errors: Error[] = [];
  run();

  async function run() {
    try {
      await work();

      if (errors.length > 0) {
        errors.length = 0;
      }

      log.info('Runner', `Finished successfully; waiting ${normalInterval} for next loop.`);
      setTimeout(run, parseTimeToMs(normalInterval));
    }
    catch (e: any) {
      log.error('Runner', 'Error:', e);
      errors.push(e);

      const longTermFailure = (errors.length % errorTries === 0);
      const waitTime = longTermFailure ? normalInterval : errorInterval;

      log.warn('Runner', `Run canceled by error. Trying again in ${waitTime}.`);

      setTimeout(run, parseTimeToMs(waitTime));

      if (longTermFailure) {
        await failed(errors);
        errors.length = 0;
      }
    }
  }
}

function parseTimeToMs(str: string) {
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
        ? UNITS[key as keyof typeof UNITS]
        : 1);
    })
    .reduce(
      (a, b) => a + b,
      0));
}
