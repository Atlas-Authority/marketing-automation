import { cliParams } from "../lib/cli/arg-parser.js";
import Engine from "../lib/engine/engine.js";
import { MemoryRemote } from "../lib/io/memory-remote.js";
import { Database } from "../lib/model/database.js";

cliParams.failIfExtraOpts();

const memoryRemote = new MemoryRemote({ verbose: false });
const engine = new Engine();

// First
await engine.run(new Database(memoryRemote, memoryRemote));

// Second
memoryRemote.verbose = true;
await engine.run(new Database(memoryRemote, memoryRemote));

// Third
await engine.run(new Database(memoryRemote, memoryRemote));
