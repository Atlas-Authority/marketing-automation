import { downloadAllData } from '../lib/io/downloader/download-initial-data.js';
import LiveDownloader from '../lib/io/downloader/live-downloader.js';

downloadAllData({
  downloader: new LiveDownloader()
});
