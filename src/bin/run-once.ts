import { getCliOptions } from "../lib/cli/index.js";
import Engine from "../lib/engine/engine.js";
import { Database } from "../lib/model/database.js";

const { downloader, uploader } = getCliOptions();
const db = new Database(downloader, uploader);

await new Engine(db).run();
