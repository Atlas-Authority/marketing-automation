const Options = {

  loglevel: {
    values: 'error | warn | info | verbose',
    description: '(Optional) What the engine should log to console.log()',
  },

  savelogs: {
    values: 'somedir',
    description: '(Optional) Log helpful debug files under `data/somedir/`',
  },

};

export function getCliArgs<T extends keyof typeof Options>(...allowedOptions: T[]) {
  const args = Object.fromEntries(process.argv.slice(2)
    .map(s => s.split('='))
    .map(([k, v]) => [k.replace(/^--?/, ''), v || 'true']));

  if (args['help'] || args['h']) showHelp(allowedOptions);

  const opts = {} as { [K in T]: string };
  for (const param of allowedOptions) {
    opts[param] = args[param];
    delete args[param];
  }

  if (Object.keys(args).length > 0) {
    console.log(`Error: Unknown arguments passed:`);
    console.log(Object.entries(args)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join('\n'))
    showHelp(allowedOptions);
  }

  return opts;
}

function showHelp(allowedOptions: (keyof typeof Options)[]) {
  console.log();
  console.log(`Allowed options:`);
  console.log();
  for (const param of allowedOptions) {
    const details = Options[param];
    if (details) {
      console.log(`    --${param}    ${details.values}`);
      console.log(`        ${details.description}`);
      console.log();
    }
  }
  process.exit(1);
}
