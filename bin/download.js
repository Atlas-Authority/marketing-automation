import { downloadInitialData } from '../lib/downloader/download-initial-data.js';
import LiveDownloader from '../lib/downloader/live-downloader.js';

downloadInitialData({
  downloader: new LiveDownloader()
});
