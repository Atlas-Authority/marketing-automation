import Engine from "../lib/engine/engine.js";
import { MemoryRemote } from "../lib/io/memory-remote.js";
import { Database } from "../lib/model/database.js";

const memoryRemote = new MemoryRemote({ verbose: false });

{
  const db = new Database(memoryRemote, memoryRemote);
  const engine = new Engine(db);
  await engine.run();
}

{
  memoryRemote.verbose = true;
  const db = new Database(memoryRemote, memoryRemote);
  const engine = new Engine(db);
  await engine.run();
}
