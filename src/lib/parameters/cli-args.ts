type Opts<T extends string> = { [K in T]: string | undefined };

type Help = { [key: string]: { values: string, description: string } };

const help: Help = {

  loglevel: {
    values: 'error | warn | info | verbose',
    description: '(Optional) What the engine should log to console.log()',
  },

  savelogs: {
    values: 'somedir',
    description: '(Optional) Log helpful debug files under `data/somedir/`',
  },

  skiplogs: {
    values: '',
    description: '(Optional) Do not write engine log files',
  },

};

export function getCliArgs<T extends string>(...params: T[]): Opts<T> {
  const args = Object.fromEntries(process.argv.slice(2)
    .map(s => s.split('='))
    .map(([k, v]) => [k.replace(/^--?/, ''), v || 'true']));

  if (args['help'] || args['h']) showHelp(params);

  const opts = {} as Opts<T>;
  for (const param of params) {
    opts[param] = args[param];
    delete args[param];
  }

  if (Object.keys(args).length > 0) {
    console.log(`Error: Unknown arguments passed:`);
    console.log(Object.entries(args)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join('\n'))
    showHelp(params);
  }

  return opts;
}

function showHelp(params: string[]) {
  console.log();
  console.log(`Allowed options:`);
  console.log();
  for (const param of params) {
    const details = help[param];
    if (details) {
      console.log(`    --${param}    ${details.values}`);
      console.log(`        ${details.description}`);
      console.log();
    }
  }
  process.exit(1);
}
