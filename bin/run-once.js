import runEngine from "../lib/engine/engine.js";
import normalizeData from "../lib/normalizations/normalize-data.js";
import { getCliOptions } from "../lib/util/cli.js";

const { downloader, uploader } = getCliOptions();

await normalizeData({ downloader, uploader });

await runEngine({
  downloader,
  uploader,
});
