import { getCliOptions } from "../lib/cli/index.js";
import runEngine from "../lib/engine/engine.js";
import { Database } from "../lib/model/database.js";

const { downloader, uploader } = getCliOptions();
const db = new Database(downloader, uploader);

await runEngine(db);
