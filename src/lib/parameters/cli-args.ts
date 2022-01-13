type Opts<T extends string> = { [K in T]: string | undefined };

export function getCliArgs<T extends string>(...params: T[]): Opts<T> {
  const args = Object.fromEntries(process.argv.slice(2)
    .map(s => s.split('='))
    .map(([k, v]) => [k.replace(/^--/, ''), v || 'true']));

  const opts = {} as Opts<T>;
  for (const param of params) {
    opts[param] = args[param];
    delete args[param];
  }

  if (Object.keys(args).length > 0) {
    console.log(`Error: Unknown arguments passed:`, args);
    process.exit(1);
  }

  return opts;
}
