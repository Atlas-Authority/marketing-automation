import { cliParams } from "../lib/cli/arg-parser.js";
import { getIoFromCli } from "../lib/cli/index.js";
import Engine from "../lib/engine/engine.js";
import { Database } from "../lib/model/database.js";

const io = getIoFromCli();
cliParams.failIfExtraOpts();

const db = new Database(io);

await new Engine().run(db);
