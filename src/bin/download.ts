import LiveDownloader from '../lib/io/downloader/live-downloader.js';
import ConsoleUploader from '../lib/io/uploader/console-uploader.js';
import { Database } from '../lib/model/database.js';

const db = new Database(new LiveDownloader(), new ConsoleUploader({ verbose: true }));
await db.downloadAllData();
