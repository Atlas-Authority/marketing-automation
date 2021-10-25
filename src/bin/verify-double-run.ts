import Engine from "../lib/engine/engine.js";
import CachedFileDownloader from "../lib/io/downloader/cached-file-downloader.js";
import ConsoleUploader from "../lib/io/uploader/console-uploader.js";
import { Database } from "../lib/model/database.js";

const downloader = new CachedFileDownloader();
const uploader = new ConsoleUploader({ verbose: false });
const db = new Database(downloader, uploader);

{
  const engine = new Engine(db);
  await engine.run();
  db.dealManager.createdCount = 0;
  db.dealManager.updatedCount = 0;
  db.contactManager.createdCount = 0;
  db.contactManager.createdCount = 0;
  db.companyManager.updatedCount = 0;
  db.companyManager.updatedCount = 0;
}

{
  const engine = new Engine(db);
  engine.shouldDownload = false;
  await engine.run();
}
