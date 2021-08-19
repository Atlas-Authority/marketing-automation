import { downloadAllData } from '../lib/downloader/download-initial-data.js';
import LiveDownloader from '../lib/downloader/live-downloader.js';

downloadAllData({
  downloader: new LiveDownloader()
});
