import LiveDownloader from '../lib/io/live-downloader.js';
import { MemoryRemote } from '../lib/io/memory-remote.js';
import { Database } from '../lib/model/database.js';

const db = new Database(new LiveDownloader(), new MemoryRemote({ verbose: true }));
await db.downloadAllData();
