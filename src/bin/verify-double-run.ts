import Engine from "../lib/engine/engine.js";
import { MemoryRemote } from "../lib/io/memory-remote.js";
import { Database } from "../lib/model/database.js";

const memoryRemote = new MemoryRemote({ verbose: false });

{
  const db = new Database(memoryRemote, memoryRemote);
  const engine = new Engine(db);
  await engine.run();
  db.dealManager.createdCount = 0;
  db.dealManager.updatedCount = 0;
  db.dealManager.duplicatesToDelete.clear();
  db.contactManager.createdCount = 0;
  db.contactManager.updatedCount = 0;
  db.companyManager.createdCount = 0;
  db.companyManager.updatedCount = 0;
}

{
  memoryRemote.verbose = true;
  const db = new Database(memoryRemote, memoryRemote);
  const engine = new Engine(db);
  await engine.run();
}
