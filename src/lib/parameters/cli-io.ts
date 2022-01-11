import { Remote } from "../io/interfaces";
import { CachedMemoryRemote, IO, LiveRemote } from "../io/io";
import { cli } from "./cli-args";
import { serviceCredsFromENV } from "./env-config";

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
      case 'remote': return new LiveRemote(serviceCredsFromENV());
    }
  }
}
