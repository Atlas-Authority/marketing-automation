import LiveRemote from '../lib/io/live-remote.js';
import { MemoryRemote } from '../lib/io/memory-remote.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';

log.level = log.Levels.Verbose;
const db = new Database(new LiveRemote(), new MemoryRemote());
await db.downloadAllData();
