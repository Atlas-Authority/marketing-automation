import { cliParams } from "../lib/cli/arg-parser.js";
import Engine from "../lib/engine/engine.js";
import { IO } from "../lib/io/io.js";
import log from "../lib/log/logger.js";
import { Database } from "../lib/model/database.js";

cliParams.failIfExtraOpts();
log.level = log.Levels.Info;

const io = new IO({ in: 'local', out: 'local' });
const engine = new Engine();

// First
await engine.run(new Database(io));

// Second
log.level = log.Levels.Verbose;
await engine.run(new Database(io));

// Third
await engine.run(new Database(io));
