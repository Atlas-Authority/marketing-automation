import chalk from "chalk";
import util from "util";

export class ConsoleLogger {

  public printError(prefix: string, ...args: any[]) {
    this.print('error', chalk.red('ERR!'), prefix, ...args);
  }

  public printWarning(prefix: string, ...args: any[]) {
    this.print('error', chalk.dim.redBright('WARN'), prefix, ...args);
  }

  public printInfo(prefix: string, ...args: any[]) {
    this.print('log', chalk.green('info'), prefix, ...args);
  }

  private print(printer: 'log' | 'error', style: string, prefix: string, ...args: any[]) {
    const styledPrefix = chalk.magenta(prefix);

    const lastDataArg = args.pop();
    const printDataArg = (typeof lastDataArg !== 'string');
    if (!printDataArg) args.push(lastDataArg);

    const time = new Date().toLocaleString();
    const styledTime = chalk.dim.yellow(time);

    if (args.length > 0) {
      const firstLine = args.join(' ');
      for (const line of firstLine.split('\n')) {
        console[printer]([styledTime, style, styledPrefix, line].join(' '));
      }
    }

    if (printDataArg) {
      const spacer = args.length > 0 ? '  ' : '';
      const nextLineIndent = time.length + 1 + 4 + 1 + prefix.length + 1 + spacer.length;

      const formattedLastArg = formatted(lastDataArg, nextLineIndent);
      for (const line of formattedLastArg.split('\n')) {
        console[printer]([styledTime, style, styledPrefix, spacer + line].join(' '));
      }
    }
  }
}

function formatted(data: unknown, prefixLength: number) {
  return util.inspect(data, {
    breakLength: (process.stdout.columns || 200) - prefixLength,
    colors: true,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
