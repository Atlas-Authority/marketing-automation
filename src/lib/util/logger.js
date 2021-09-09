import util from 'util';

export const info = log.bind(null, 'info');
export const warn = log.bind(null, 'warn');
export const error = log.bind(null, 'error');

let enabled = true;
export function enable() { enabled = true; }
export function disable() { enabled = false; }

const great = '\x1b[32m';
const nerve = '\x1b[43;30;1m';
const scary = '\x1b[40;31;1m';
const reset = '\x1b[0m';
const royal = '\x1b[35m';
const relax = '\x1b[33;2m';

const levelPrefixes = {
  info: `${great}info${reset}`,
  warn: `${nerve}WARN${reset}`,
  error: `${scary}ERR!${reset}`,
};

/**
 * @param {'info' | 'warn' | 'error'} level
 * @param {string} prefix
 * @param  {...any} args
 */
function log(level, prefix, ...args) {
  if (!enabled) return;

  const first = levelPrefixes[level];
  const styledPrefix = `${royal}${prefix}${reset}`;

  const lastDataArg = args.pop();
  const printDataArg = (typeof lastDataArg !== 'string');
  if (!printDataArg) args.push(lastDataArg);

  const time = new Date().toLocaleString();
  const styledTime = `${relax}${time}${reset}`;

  if (args.length > 0) {
    const firstLine = args.join(' ');
    for (const line of firstLine.split('\n')) {
      console.log([styledTime, first, styledPrefix, line].join(' '));
    }
  }

  if (printDataArg) {
    const spacer = args.length > 0 ? '  ' : '';
    const nextLineIndent = time.length + 1 + 4 + 1 + prefix.length + 1 + spacer.length;

    const formattedLastArg = formatted(lastDataArg, nextLineIndent);
    for (const line of formattedLastArg.split('\n')) {
      console.log([styledTime, first, styledPrefix, spacer + line].join(' '));
    }
  }
}

/**
 * @param {unknown} data
 * @param {number} prefixLength
 */
function formatted(data, prefixLength) {
  return util.inspect(data, {
    breakLength: (process.stdout.columns || 200) - prefixLength,
    colors: true,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
