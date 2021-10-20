import { Database } from '../../model/database.js';
import ConsoleUploader from '../uploader/console-uploader.js';
import { Uploader } from '../uploader/uploader.js';
import { Downloader } from './downloader.js';

export async function downloadAllData({ downloader, uploader }: {
  downloader: Downloader,
  uploader?: Uploader,
}): Promise<Database> {
  if (!uploader) uploader = new ConsoleUploader({ verbose: true });
  const db = new Database(downloader, uploader);
  await db.downloadAllData();
  return db;
}
