import { Remote } from "../io/interfaces.js";
import { MemoryRemote } from "../io/memory-remote.js";
import LiveRemote from './live-remote.js';

export class IO {

  public in: Remote;
  public out: Remote;

  constructor(opts: { in: 'local' | 'remote', out: 'local' | 'remote' }) {
    if (opts.in === 'local' && opts.out === 'local') {
      this.in = this.out = new MemoryRemote();
    }
    else if (opts.in === 'remote' && opts.out === 'remote') {
      this.in = this.out = new LiveRemote();
    }
    else {
      this.in = remoteFor(opts.in);
      this.out = remoteFor(opts.out);
    }
  }

}

function remoteFor(opt: 'local' | 'remote'): Remote {
  switch (opt) {
    case 'local': return new MemoryRemote();
    case 'remote': return new LiveRemote();
  }
}
