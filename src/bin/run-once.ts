import Engine from "../lib/engine/engine.js";
import { getIoFromCli } from "../lib/io/io.js";
import { Database } from "../lib/model/database.js";
import { cliParams } from "../lib/parameters/cli.js";

const io = getIoFromCli();
cliParams.failIfExtraOpts();

const db = new Database(io);

await new Engine().run(db);
