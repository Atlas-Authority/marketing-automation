import Engine from "../lib/engine/engine.js";
import { IO } from "../lib/io/io.js";
import { Database } from "../lib/model/database.js";
import { cli } from "../lib/parameters/cli.js";

const io = IO.fromCli();
cli.failIfExtraOpts();

const db = new Database(io);

await new Engine().run(db);
