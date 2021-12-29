import 'source-map-support/register';
import { useCachedFunctions } from '../lib/cache/fn-cache';
import Engine from "../lib/engine/engine";
import { Remote } from '../lib/io/interfaces';
import { CachedMemoryRemote, IO, LiveRemote } from "../lib/io/io";
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));
  useCachedFunctions(cli.get('--cached-fns')?.split(','));

  const io = ioFromCliArgs();
  cli.failIfExtraOpts();

  const db = new Database(io, envConfig);

  await new Engine().run(db);

}

export function ioFromCliArgs() {
  const io = new IO();

  const opts = {
    in: cli.getChoiceOrFail('--in', ['local', 'remote']),
    out: cli.getChoiceOrFail('--out', ['local', 'remote']),
  };

  if (opts.in === opts.out) {
    io.in = io.out = remoteFor(opts.in);
  }
  else {
    io.in = remoteFor(opts.in);
    io.out = remoteFor(opts.out);
  }

  return io;

  function remoteFor(opt: 'local' | 'remote'): Remote {
    switch (opt) {
      case 'local': return new CachedMemoryRemote();
      case 'remote': return new LiveRemote();
    }
  }
}
