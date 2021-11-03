import { cliParams } from "../lib/cli/arg-parser.js";
import Engine from "../lib/engine/engine.js";
import { MemoryRemote } from "../lib/io/memory-remote.js";
import log from "../lib/log/logger.js";
import { Database } from "../lib/model/database.js";

cliParams.failIfExtraOpts();
log.level = log.Levels.Info;

const memoryRemote = new MemoryRemote();
const engine = new Engine();

// First
await engine.run(new Database(memoryRemote, memoryRemote));

// Second
log.level = log.Levels.Verbose;
await engine.run(new Database(memoryRemote, memoryRemote));

// Third
await engine.run(new Database(memoryRemote, memoryRemote));
