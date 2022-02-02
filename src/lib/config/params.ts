
export const cliArgs = process.argv.slice(2);
export let fastMode = false;

const fastIndex = cliArgs.indexOf('fast');
if (fastIndex !== -1) {
  cliArgs.splice(fastIndex, 1);
  fastMode = true;
}
