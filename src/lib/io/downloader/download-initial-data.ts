import { Downloader } from './downloader.js';
import { Uploader } from '../uploader/uploader.js';
import ConsoleUploader from '../uploader/console-uploader.js';
import { Database } from '../../model/database.js';

export async function downloadAllData({ downloader, uploader }: {
  downloader: Downloader,
  uploader?: Uploader,
}): Promise<Database> {
  if (!uploader) uploader = new ConsoleUploader({ verbose: true });
  const db = new Database(downloader, uploader);
  await db.downloadAllData();
  return db;
}
