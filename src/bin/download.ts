import { downloadAllData } from '../lib/data/downloader/download-initial-data.js';
import LiveDownloader from '../lib/data/downloader/live-downloader.js';

downloadAllData({
  downloader: new LiveDownloader()
});
