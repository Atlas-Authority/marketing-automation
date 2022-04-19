import { ConsoleLogger } from "../log/console";

export interface RunLoopConfig {
  runInterval: string,
  retryInterval: string,
  retryTimes: number,
}

export default function run(console: ConsoleLogger, loopConfig: RunLoopConfig, { work, failed }: {
  work: () => Promise<void>,
  failed: (errors: Error[]) => Promise<void>,
}) {
  console.printInfo('Runner', 'Starting with options:', loopConfig);
  const normalInterval = loopConfig.runInterval;
  const errorInterval = loopConfig.retryInterval;
  const errorTries = loopConfig.retryTimes;

  console.printInfo('Runner', 'Running loop');
  const errors: Error[] = [];
  void run();

  async function run() {
    try {
      await work();

      if (errors.length > 0) {
        errors.length = 0;
      }

      console.printInfo('Runner', `Finished successfully; waiting ${normalInterval} for next loop.`);
      setTimeout(run, parseTimeToMs(normalInterval));
    }
    catch (e: any) {
      console.printError('Runner', 'Error:', e);
      errors.push(e);

      const longTermFailure = (errors.length % errorTries === 0);
      const waitTime = longTermFailure ? normalInterval : errorInterval;

      console.printWarning('Runner', `Run canceled by error. Trying again in ${waitTime}.`);

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
